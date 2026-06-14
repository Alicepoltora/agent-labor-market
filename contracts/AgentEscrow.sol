// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentEscrow
 * @notice On-chain escrow for AI Agent Labor Market
 * @dev Holds USDC until LLM judge verdict is submitted by platform oracle
 */
contract AgentEscrow is Ownable, ReentrancyGuard {

    IERC20 public immutable usdc;
    address public oracle;          // Platform backend that submits verdicts
    uint256 public platformFeeBps;  // In basis points (200 = 2%)
    address public feeRecipient;

    enum TaskStatus { Open, Claimed, Submitted, Completed, Disputed, Expired }

    struct Task {
        bytes32 id;
        address requester;
        address solver;
        uint256 reward;             // USDC amount (6 decimals)
        TaskStatus status;
        uint256 deadline;
        bytes32 descriptionHash;    // keccak256 of task description
        bytes32 rubricHash;         // keccak256 of evaluation rubric
    }

    mapping(bytes32 => Task) public tasks;
    bytes32[] public taskIds;

    // Events
    event TaskCreated(bytes32 indexed taskId, address indexed requester, uint256 reward, uint256 deadline);
    event TaskClaimed(bytes32 indexed taskId, address indexed solver);
    event ResultSubmitted(bytes32 indexed taskId, address indexed solver, bytes32 resultHash);
    event TaskCompleted(bytes32 indexed taskId, address indexed solver, uint256 solverPayout, uint256 platformFee);
    event TaskDisputed(bytes32 indexed taskId, string reason);
    event TaskExpired(bytes32 indexed taskId, address indexed requester, uint256 refund);
    event OracleChanged(address indexed oldOracle, address indexed newOracle);

    // Errors
    error TaskNotFound();
    error InvalidStatus(TaskStatus expected, TaskStatus actual);
    error Unauthorized();
    error DeadlinePassed();
    error InsufficientDeposit();
    error TransferFailed();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert Unauthorized();
        _;
    }

    modifier taskExists(bytes32 taskId) {
        if (tasks[taskId].requester == address(0)) revert TaskNotFound();
        _;
    }

    constructor(
        address _usdc,
        address _oracle,
        uint256 _platformFeeBps,
        address _feeRecipient
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        oracle = _oracle;
        platformFeeBps = _platformFeeBps;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Create a new task with USDC deposit
     * @param taskId Unique task ID (bytes32 of UUID)
     * @param reward USDC reward amount (in 6-decimal units, e.g. 1e6 = 1 USDC)
     * @param deadlineTimestamp Unix timestamp of deadline
     * @param descriptionHash keccak256 of task description (for verifiability)
     * @param rubricHash keccak256 of evaluation rubric
     */
    function createTask(
        bytes32 taskId,
        uint256 reward,
        uint256 deadlineTimestamp,
        bytes32 descriptionHash,
        bytes32 rubricHash
    ) external nonReentrant {
        if (tasks[taskId].requester != address(0)) revert TaskNotFound(); // already exists
        if (deadlineTimestamp <= block.timestamp) revert DeadlinePassed();
        if (reward == 0) revert InsufficientDeposit();

        // Transfer USDC from requester to contract
        bool ok = usdc.transferFrom(msg.sender, address(this), reward);
        if (!ok) revert TransferFailed();

        tasks[taskId] = Task({
            id: taskId,
            requester: msg.sender,
            solver: address(0),
            reward: reward,
            status: TaskStatus.Open,
            deadline: deadlineTimestamp,
            descriptionHash: descriptionHash,
            rubricHash: rubricHash
        });

        taskIds.push(taskId);
        emit TaskCreated(taskId, msg.sender, reward, deadlineTimestamp);
    }

    /**
     * @notice Solver claims a task (on-chain lock-in)
     */
    function claimTask(bytes32 taskId) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.Open) revert InvalidStatus(TaskStatus.Open, task.status);
        if (block.timestamp > task.deadline) revert DeadlinePassed();

        task.solver = msg.sender;
        task.status = TaskStatus.Claimed;

        emit TaskClaimed(taskId, msg.sender);
    }

    /**
     * @notice Solver submits result hash (actual result stored off-chain)
     * @param resultHash keccak256 of the submitted result
     */
    function submitResult(bytes32 taskId, bytes32 resultHash) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.Claimed) revert InvalidStatus(TaskStatus.Claimed, task.status);
        if (task.solver != msg.sender) revert Unauthorized();

        task.status = TaskStatus.Submitted;
        emit ResultSubmitted(taskId, msg.sender, resultHash);
    }

    /**
     * @notice Oracle releases escrow to solver (ACCEPT verdict)
     */
    function releaseEscrow(bytes32 taskId) external onlyOracle taskExists(taskId) nonReentrant {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.Submitted && task.status != TaskStatus.Disputed) {
            revert InvalidStatus(TaskStatus.Submitted, task.status);
        }

        uint256 fee = (task.reward * platformFeeBps) / 10000;
        uint256 solverPayout = task.reward - fee;

        task.status = TaskStatus.Completed;

        // Pay solver
        bool ok1 = usdc.transfer(task.solver, solverPayout);
        if (!ok1) revert TransferFailed();

        // Pay platform fee
        if (fee > 0) {
            bool ok2 = usdc.transfer(feeRecipient, fee);
            if (!ok2) revert TransferFailed();
        }

        emit TaskCompleted(taskId, task.solver, solverPayout, fee);
    }

    /**
     * @notice Oracle refunds escrow to requester (REJECT verdict)
     */
    function refundEscrow(bytes32 taskId) external onlyOracle taskExists(taskId) nonReentrant {
        Task storage task = tasks[taskId];

        task.status = TaskStatus.Expired;
        bool ok = usdc.transfer(task.requester, task.reward);
        if (!ok) revert TransferFailed();

        emit TaskExpired(taskId, task.requester, task.reward);
    }

    /**
     * @notice Requester or oracle opens a dispute
     */
    function disputeTask(bytes32 taskId, string calldata reason) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        if (msg.sender != task.requester && msg.sender != oracle) revert Unauthorized();
        if (task.status != TaskStatus.Submitted) revert InvalidStatus(TaskStatus.Submitted, task.status);

        task.status = TaskStatus.Disputed;
        emit TaskDisputed(taskId, reason);
    }

    /**
     * @notice Anyone can expire a task past its deadline
     */
    function expireTask(bytes32 taskId) external taskExists(taskId) nonReentrant {
        Task storage task = tasks[taskId];
        if (block.timestamp <= task.deadline) revert DeadlinePassed();
        if (task.status != TaskStatus.Open && task.status != TaskStatus.Claimed) {
            revert InvalidStatus(TaskStatus.Open, task.status);
        }

        task.status = TaskStatus.Expired;
        bool ok = usdc.transfer(task.requester, task.reward);
        if (!ok) revert TransferFailed();

        emit TaskExpired(taskId, task.requester, task.reward);
    }

    // --- Admin ---

    function setOracle(address _oracle) external onlyOwner {
        emit OracleChanged(oracle, _oracle);
        oracle = _oracle;
    }

    function setPlatformFee(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        platformFeeBps = _bps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    // --- View ---

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function totalTasks() external view returns (uint256) {
        return taskIds.length;
    }
}
