// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract AgentLaborMarket {
    IERC20 public immutable usdc;
    address public owner;
    address public feeRecipient;
    uint256 public platformFeeBps = 200;
    uint256 private _taskCounter;

    enum TaskStatus { Open, Claimed, Submitted, Completed, Rejected, Expired }

    struct Task {
        uint256 id;
        address client;
        address solver;
        address evaluator;
        string title;
        string description;
        string capabilities;
        uint256 reward;
        uint256 expiresAt;
        TaskStatus status;
        bytes32 deliverableHash;
        string apiTaskId;
    }

    mapping(uint256 => Task) public tasks;
    mapping(address => uint256) public agentTotalEarned;
    mapping(address => uint256) public agentTasksDone;

    event TaskPosted(uint256 indexed taskId, address indexed client, uint256 reward, string apiTaskId, string title);
    event TaskClaimed(uint256 indexed taskId, address indexed solver);
    event DeliverableSubmitted(uint256 indexed taskId, address indexed solver, bytes32 deliverableHash);
    event TaskCompleted(uint256 indexed taskId, address indexed solver, uint256 payout, uint256 fee);
    event TaskRejected(uint256 indexed taskId, address indexed solver, bytes32 reason);
    event TaskExpired(uint256 indexed taskId, address indexed client, uint256 refund);

    modifier onlyOwner() { require(msg.sender == owner, "ALM: not owner"); _; }
    modifier taskExists(uint256 _id) { require(tasks[_id].id != 0, "ALM: not found"); _; }

    constructor(address _usdc, address _feeRecipient) {
        require(_usdc != address(0) && _feeRecipient != address(0), "ALM: zero addr");
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
        owner = msg.sender;
    }

    function postTask(
        string calldata _title, string calldata _description, string calldata _capabilities,
        uint256 _reward, uint256 _durationSeconds, string calldata _apiTaskId, address _evaluator
    ) external returns (uint256 taskId) {
        require(_reward > 0, "ALM: zero reward");
        require(_durationSeconds > 0 && _durationSeconds <= 7 days, "ALM: bad duration");
        require(usdc.transferFrom(msg.sender, address(this), _reward), "ALM: transfer failed");

        taskId = ++_taskCounter;
        tasks[taskId] = Task(taskId, msg.sender, address(0),
            _evaluator == address(0) ? owner : _evaluator,
            _title, _description, _capabilities, _reward,
            block.timestamp + _durationSeconds, TaskStatus.Open, bytes32(0), _apiTaskId);

        emit TaskPosted(taskId, msg.sender, _reward, _apiTaskId, _title);
    }

    function claimTask(uint256 _taskId) external taskExists(_taskId) {
        Task storage t = tasks[_taskId];
        require(t.status == TaskStatus.Open, "ALM: not open");
        require(block.timestamp < t.expiresAt, "ALM: expired");
        require(msg.sender != t.client, "ALM: client cant solve");
        t.solver = msg.sender;
        t.status = TaskStatus.Claimed;
        emit TaskClaimed(_taskId, msg.sender);
    }

    function submitDeliverable(uint256 _taskId, bytes32 _hash) external taskExists(_taskId) {
        Task storage t = tasks[_taskId];
        require(t.status == TaskStatus.Claimed, "ALM: not claimed");
        require(msg.sender == t.solver, "ALM: only solver");
        require(block.timestamp < t.expiresAt, "ALM: expired");
        require(_hash != bytes32(0), "ALM: empty hash");
        t.deliverableHash = _hash;
        t.status = TaskStatus.Submitted;
        emit DeliverableSubmitted(_taskId, msg.sender, _hash);
    }

    function completeTask(uint256 _taskId, bytes32 _reason) external taskExists(_taskId) {
        Task storage t = tasks[_taskId];
        require(t.status == TaskStatus.Submitted, "ALM: not submitted");
        require(msg.sender == t.evaluator || msg.sender == owner, "ALM: not auth");
        uint256 fee = (t.reward * platformFeeBps) / 10_000;
        uint256 payout = t.reward - fee;
        t.status = TaskStatus.Completed;
        agentTotalEarned[t.solver] += payout;
        agentTasksDone[t.solver]++;
        if (fee > 0) require(usdc.transfer(feeRecipient, fee), "ALM: fee failed");
        require(usdc.transfer(t.solver, payout), "ALM: payout failed");
        emit TaskCompleted(_taskId, t.solver, payout, fee);
    }

    function rejectTask(uint256 _taskId, bytes32 _reason) external taskExists(_taskId) {
        Task storage t = tasks[_taskId];
        require(t.status == TaskStatus.Submitted, "ALM: not submitted");
        require(msg.sender == t.evaluator || msg.sender == owner, "ALM: not auth");
        t.status = TaskStatus.Rejected;
        require(usdc.transfer(t.client, t.reward), "ALM: refund failed");
        emit TaskRejected(_taskId, t.solver, _reason);
    }

    function expireTask(uint256 _taskId) external taskExists(_taskId) {
        Task storage t = tasks[_taskId];
        require(t.status == TaskStatus.Open || t.status == TaskStatus.Claimed || t.status == TaskStatus.Submitted, "ALM: finalized");
        require(block.timestamp >= t.expiresAt, "ALM: not expired");
        t.status = TaskStatus.Expired;
        require(usdc.transfer(t.client, t.reward), "ALM: refund failed");
        emit TaskExpired(_taskId, t.client, t.reward);
    }

    function getTask(uint256 _taskId) external view returns (Task memory) { return tasks[_taskId]; }
    function getAgentStats(address _a) external view returns (uint256, uint256) { return (agentTotalEarned[_a], agentTasksDone[_a]); }
    function totalTasksPosted() external view returns (uint256) { return _taskCounter; }
    function setPlatformFee(uint256 _bps) external onlyOwner { require(_bps <= 1000); platformFeeBps = _bps; }
    function setFeeRecipient(address _r) external onlyOwner { require(_r != address(0)); feeRecipient = _r; }
    function transferOwnership(address _n) external onlyOwner { require(_n != address(0)); owner = _n; }
}
