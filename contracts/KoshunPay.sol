// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract KoshunPay {
    error OnlyOwner();
    error ZeroAddress();
    error OnlyTourist();
    error TourNotFound();
    error TourInactive();
    error AlreadyBooked();
    error TransferFromFailed();
    error TransferFailed();
    error OrderNotFound();
    error OnlyOrderOwner();
    error NotPaid();
    error AlreadyProcessed();
    error TooEarly();
    error Disputed();
    error DisputeActive();
    error DisputeExists();
    error NotPending();
    error NotApproved();
    error NotDisputed();
    error NewOwnerSelf();
    error NewOwnerGos();
    error NewOwnerGuide();
    error NotCompleted();
    error NotProcessed();
    error NewOwnerHasOrder();
    error OnlyGuide();
    error OnlyGos();
    error ZeroBalance();
    error HeaderEmpty();
    error DescEmpty();
    error ImageEmpty();
    error PriceZero();
    error SeatsZero();

    struct Tour {
        address guide;
        string header;
        string description;
        string image;
        string phone;
        uint256 price;
        uint64 deadline;
        uint32 seatsTotal;
        uint32 seatsRemaining;
    }

    enum OrderStatus {
        None,
        Paid,
        Completed,
        Disputed,
        Refunded
    }

    enum DisputeStatus {
        None,
        Pending,
        Approved,
        Rejected
    }

    struct Order {
        uint256 tourId;
        address owner;
        address guide;
        uint256 amount;
        uint64 paidAt;
        uint64 releaseTime;
        OrderStatus status;
        bool isProcessed;
        bool isDisputed;
    }

    struct Dispute {
        DisputeStatus status;
        uint64 createdAt;
        uint64 resolvedAt;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event GosAddressChanged(address indexed previousGos, address indexed newGos);
    event GuideRegistered(address indexed guide);
    event TourCreated(uint256 indexed tourId, address indexed guide, uint256 price, uint64 deadline, uint32 seatsTotal);
    event PaymentReceived(uint256 indexed orderId, uint256 indexed tourId, address indexed tourist, uint256 amount, uint64 releaseTime);
    event PaymentDistributed(
        uint256 indexed orderId,
        uint256 indexed tourId,
        address indexed tourist,
        address guide,
        uint256 totalAmount,
        uint256 guideAmount,
        uint256 gosAmount,
        uint256 reserveAmount
    );
    event DisputeOpened(uint256 indexed orderId, uint256 indexed tourId, address indexed tourist);
    event DisputeResolved(uint256 indexed orderId, DisputeStatus status);
    event RefundExecuted(uint256 indexed orderId, address indexed tourist, uint256 amount);
    event BookingTransferred(uint256 indexed orderId, uint256 indexed tourId, address indexed from, address to);
    event Withdrawn(address indexed beneficiary, uint256 amount);

    uint64 public constant DEFAULT_TOUR_DURATION = 72 hours;
    uint64 public constant DEFAULT_RELEASE_DELAY = 72 hours;

    uint256 private constant PERCENT_DENOM = 100;
    uint256 private constant GUIDE_PERCENT = 85;
    uint256 private constant GOS_PERCENT = 10;

    address public owner;
    IERC20 public immutable paymentToken;
    address public gosAddress;

    uint256 public tourCount;
    mapping(uint256 => Tour) private tours;

    mapping(address => bool) public isGuide;
    address[] private guides;
    mapping(address => uint256[]) private guideTourIds;

    uint256 public orderCount;
    mapping(uint256 => Order) private orders;
    mapping(uint256 => Dispute) private disputes;

    mapping(uint256 => mapping(address => uint256)) private orderIdByTourAndOwner;
    mapping(address => uint256[]) private userOrderIds;

    uint256[] private pendingOrders;
    mapping(uint256 => uint256) private pendingIndexPlusOne;

    mapping(address => uint256) public guideBalance;
    uint256 public gosBalance;
    uint256 public reserveBalance;

    constructor(address paymentTokenAddress, address gosAddress_) {
        if (paymentTokenAddress == address(0) || gosAddress_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        paymentToken = IERC20(paymentTokenAddress);
        gosAddress = gosAddress_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit GosAddressChanged(address(0), gosAddress_);
    }

    function transferOwnership(address newOwner) external {
        _requireOwner();
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    function setGosAddress(address newGosAddress) external {
        _requireOwner();
        if (newGosAddress == address(0)) revert ZeroAddress();
        address prev = gosAddress;
        gosAddress = newGosAddress;
        emit GosAddressChanged(prev, newGosAddress);
    }

    function isTourist(address account) public view returns (bool) {
        if (account == owner) return false;
        if (account == gosAddress) return false;
        if (isGuide[account]) return false;
        return true;
    }

    function createTour(
        string calldata header,
        string calldata description,
        string calldata image,
        string calldata phone,
        uint256 price,
        uint32 seatsTotal
    ) external returns (uint256 tourId) {
        if (bytes(header).length == 0) revert HeaderEmpty();
        if (bytes(description).length == 0) revert DescEmpty();
        if (bytes(image).length == 0) revert ImageEmpty();
        if (price == 0) revert PriceZero();
        if (seatsTotal == 0) revert SeatsZero();

        tourId = ++tourCount;
        uint64 deadline = uint64(block.timestamp + DEFAULT_TOUR_DURATION);

        tours[tourId] = Tour({
            guide: msg.sender,
            header: header,
            description: description,
            image: image,
            phone: phone,
            price: price,
            deadline: deadline,
            seatsTotal: seatsTotal,
            seatsRemaining: seatsTotal
        });

        if (!isGuide[msg.sender]) {
            isGuide[msg.sender] = true;
            guides.push(msg.sender);
            emit GuideRegistered(msg.sender);
        }
        guideTourIds[msg.sender].push(tourId);

        emit TourCreated(tourId, msg.sender, price, deadline, seatsTotal);
    }

    function getTour(uint256 tourId)
        external
        view
        returns (
            address guide,
            string memory header,
            string memory description,
            string memory image,
            string memory phone,
            uint256 price,
            uint64 deadline,
            uint32 seatsTotal,
            uint32 seatsRemaining,
            bool active
        )
    {
        Tour storage t = tours[tourId];
        if (t.guide == address(0)) revert TourNotFound();

        guide = t.guide;
        header = t.header;
        description = t.description;
        image = t.image;
        phone = t.phone;
        price = t.price;
        deadline = t.deadline;
        seatsTotal = t.seatsTotal;
        seatsRemaining = t.seatsRemaining;
        active = _isTourActive(t);
    }

    function getGuides() external view returns (address[] memory) {
        return guides;
    }

    function getGuideTourIds(address guide) external view returns (uint256[] memory) {
        return guideTourIds[guide];
    }

    function getPendingOrderIds() external view returns (uint256[] memory) {
        return pendingOrders;
    }

    function getUserOrderIds(address user) external view returns (uint256[] memory) {
        return userOrderIds[user];
    }

    function getOrder(uint256 orderId)
        external
        view
        returns (
            uint256 tourId,
            address orderOwner,
            address guide,
            uint256 amount,
            uint64 paidAt,
            uint64 releaseTime,
            OrderStatus status,
            bool isProcessed,
            bool isDisputed,
            DisputeStatus disputeStatus
        )
    {
        Order storage o = orders[orderId];
        if (o.owner == address(0)) revert OrderNotFound();
        tourId = o.tourId;
        orderOwner = o.owner;
        guide = o.guide;
        amount = o.amount;
        paidAt = o.paidAt;
        releaseTime = o.releaseTime;
        status = o.status;
        isProcessed = o.isProcessed;
        isDisputed = o.isDisputed;
        disputeStatus = disputes[orderId].status;
    }

    function getMyActiveBookedOrderIds(address user) external view returns (uint256[] memory) {
        uint256[] storage ids = userOrderIds[user];
        uint256 count;
        for (uint256 i; i < ids.length; ) {
            Order storage o = orders[ids[i]];
            if (o.owner == user && o.status != OrderStatus.Refunded && o.status != OrderStatus.None) {
                if (_isTourActive(tours[o.tourId])) {
                    unchecked {
                        count++;
                    }
                }
            }
            unchecked {
                i++;
            }
        }

        uint256[] memory out = new uint256[](count);
        uint256 j;
        for (uint256 i; i < ids.length; ) {
            uint256 id = ids[i];
            Order storage o = orders[id];
            if (o.owner == user && o.status != OrderStatus.Refunded && o.status != OrderStatus.None) {
                if (_isTourActive(tours[o.tourId])) {
                    out[j] = id;
                    unchecked {
                        j++;
                    }
                }
            }
            unchecked {
                i++;
            }
        }
        return out;
    }

    function pay(uint256 tourId) external returns (uint256 orderId) {
        if (!isTourist(msg.sender)) revert OnlyTourist();

        Tour storage t = tours[tourId];
        if (t.guide == address(0)) revert TourNotFound();
        if (!_isTourActive(t)) revert TourInactive();
        if (orderIdByTourAndOwner[tourId][msg.sender] != 0) revert AlreadyBooked();

        unchecked {
            t.seatsRemaining -= 1;
        }
        if (t.seatsRemaining == 0) {
            t.deadline = uint64(block.timestamp);
        }

        if (!paymentToken.transferFrom(msg.sender, address(this), t.price)) revert TransferFromFailed();

        orderId = ++orderCount;
        uint64 releaseTime = uint64(block.timestamp + DEFAULT_RELEASE_DELAY);

        orders[orderId] = Order({
            tourId: tourId,
            owner: msg.sender,
            guide: t.guide,
            amount: t.price,
            paidAt: uint64(block.timestamp),
            releaseTime: releaseTime,
            status: OrderStatus.Paid,
            isProcessed: false,
            isDisputed: false
        });

        orderIdByTourAndOwner[tourId][msg.sender] = orderId;
        userOrderIds[msg.sender].push(orderId);
        _addPending(orderId);

        emit PaymentReceived(orderId, tourId, msg.sender, t.price, releaseTime);
    }

    function confirmPayment(uint256 orderId) external {
        Order storage o = orders[orderId];
        if (o.owner == address(0)) revert OrderNotFound();
        if (msg.sender != o.owner) revert OnlyOrderOwner();
        if (o.status != OrderStatus.Paid) revert NotPaid();
        if (o.isProcessed) revert AlreadyProcessed();
        if (block.timestamp < o.releaseTime) revert TooEarly();
        if (o.isDisputed) revert Disputed();
        if (disputes[orderId].status != DisputeStatus.None) revert DisputeActive();

        _internalDistribute(orderId, o);
    }

    function confirmAll(uint256 maxCount) external returns (uint256 processed) {
        _requireOwner();
        uint256 i;
        while (i < pendingOrders.length && processed < maxCount) {
            uint256 orderId = pendingOrders[i];
            Order storage o = orders[orderId];
            if (o.owner == address(0)) {
                _removePending(orderId);
                continue;
            }

            if (o.status != OrderStatus.Paid || o.isProcessed || o.isDisputed) {
                unchecked {
                    i++;
                }
                continue;
            }
            if (disputes[orderId].status != DisputeStatus.None || block.timestamp < o.releaseTime) {
                unchecked {
                    i++;
                }
                continue;
            }

            _internalDistribute(orderId, o);
            unchecked {
                processed++;
            }
        }
    }

    function openDispute(uint256 orderId) external {
        Order storage o = orders[orderId];
        if (o.owner == address(0)) revert OrderNotFound();
        if (msg.sender != o.owner) revert OnlyOrderOwner();
        if (o.status != OrderStatus.Paid) revert NotPaid();
        if (o.isProcessed) revert AlreadyProcessed();
        if (disputes[orderId].status != DisputeStatus.None) revert DisputeExists();

        disputes[orderId] = Dispute({status: DisputeStatus.Pending, createdAt: uint64(block.timestamp), resolvedAt: 0});
        o.status = OrderStatus.Disputed;
        o.isDisputed = true;

        emit DisputeOpened(orderId, o.tourId, msg.sender);
    }

    function resolveDispute(uint256 orderId, bool approve) external {
        _requireOwner();

        Order storage o = orders[orderId];
        if (o.owner == address(0)) revert OrderNotFound();

        Dispute storage d = disputes[orderId];
        if (d.status != DisputeStatus.Pending) revert NotPending();

        d.resolvedAt = uint64(block.timestamp);

        if (approve) {
            d.status = DisputeStatus.Approved;
            emit DisputeResolved(orderId, DisputeStatus.Approved);
            return;
        }

        d.status = DisputeStatus.Rejected;
        o.status = OrderStatus.Paid;
        o.isDisputed = false;
        emit DisputeResolved(orderId, DisputeStatus.Rejected);

        if (block.timestamp >= o.releaseTime) {
            _internalDistribute(orderId, o);
        }
    }

    function refund(uint256 orderId) external {
        Order storage o = orders[orderId];
        if (o.owner == address(0)) revert OrderNotFound();
        if (msg.sender != o.owner) revert OnlyOrderOwner();
        if (disputes[orderId].status != DisputeStatus.Approved) revert NotApproved();
        if (o.isProcessed) revert AlreadyProcessed();
        if (o.status != OrderStatus.Disputed) revert NotDisputed();

        o.status = OrderStatus.Refunded;
        o.isProcessed = true;
        o.isDisputed = false;
        _removePending(orderId);

        if (!paymentToken.transfer(msg.sender, o.amount)) revert TransferFailed();
        emit RefundExecuted(orderId, msg.sender, o.amount);
    }

    function transferBooking(uint256 orderId, address newOwner) external {
        if (newOwner == address(0)) revert ZeroAddress();
        if (newOwner == msg.sender) revert NewOwnerSelf();
        if (newOwner == gosAddress) revert NewOwnerGos();
        if (isGuide[newOwner]) revert NewOwnerGuide();

        Order storage o = orders[orderId];
        if (o.owner == address(0)) revert OrderNotFound();
        if (msg.sender != o.owner) revert OnlyOrderOwner();
        if (o.isDisputed) revert Disputed();
        if (disputes[orderId].status != DisputeStatus.None) revert DisputeActive();

        if (o.status != OrderStatus.Completed) revert NotCompleted();
        if (!o.isProcessed) revert NotProcessed();

        uint256 tourId = o.tourId;
        if (orderIdByTourAndOwner[tourId][newOwner] != 0) revert NewOwnerHasOrder();

        address prevOwner = o.owner;
        o.owner = newOwner;

        orderIdByTourAndOwner[tourId][prevOwner] = 0;
        orderIdByTourAndOwner[tourId][newOwner] = orderId;
        userOrderIds[newOwner].push(orderId);

        emit BookingTransferred(orderId, tourId, prevOwner, newOwner);
    }

    function withdrawGuide() external {
        if (!isGuide[msg.sender]) revert OnlyGuide();
        uint256 amount = guideBalance[msg.sender];
        if (amount == 0) revert ZeroBalance();
        guideBalance[msg.sender] = 0;
        if (!paymentToken.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawGos() external {
        if (msg.sender != gosAddress) revert OnlyGos();
        uint256 amount = gosBalance;
        if (amount == 0) revert ZeroBalance();
        gosBalance = 0;
        if (!paymentToken.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawReserve() external {
        _requireOwner();
        uint256 amount = reserveBalance;
        if (amount == 0) revert ZeroBalance();
        reserveBalance = 0;
        if (!paymentToken.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function _requireOwner() internal view {
        if (msg.sender != owner) revert OnlyOwner();
    }

    function _isTourActive(Tour storage t) internal view returns (bool) {
        if (t.seatsRemaining == 0) return false;
        if (block.timestamp >= t.deadline) return false;
        return true;
    }

    function _addPending(uint256 orderId) internal {
        if (pendingIndexPlusOne[orderId] != 0) return;
        pendingOrders.push(orderId);
        pendingIndexPlusOne[orderId] = pendingOrders.length;
    }

    function _removePending(uint256 orderId) internal {
        uint256 idxPlusOne = pendingIndexPlusOne[orderId];
        if (idxPlusOne == 0) return;
        uint256 idx = idxPlusOne - 1;
        uint256 lastId = pendingOrders[pendingOrders.length - 1];
        if (idx != pendingOrders.length - 1) {
            pendingOrders[idx] = lastId;
            pendingIndexPlusOne[lastId] = idx + 1;
        }
        pendingOrders.pop();
        pendingIndexPlusOne[orderId] = 0;
    }

    function _internalDistribute(uint256 orderId, Order storage o) internal {
        if (o.status != OrderStatus.Paid) revert NotPaid();
        if (o.isProcessed) revert AlreadyProcessed();
        if (o.isDisputed) revert Disputed();
        if (disputes[orderId].status != DisputeStatus.None) revert DisputeActive();

        o.status = OrderStatus.Completed;
        o.isProcessed = true;
        _removePending(orderId);

        uint256 total = o.amount;
        uint256 guideAmount = (total * GUIDE_PERCENT) / PERCENT_DENOM;
        uint256 gosAmount = (total * GOS_PERCENT) / PERCENT_DENOM;
        uint256 reserveAmount = total - guideAmount - gosAmount;

        guideBalance[o.guide] += guideAmount;
        gosBalance += gosAmount;
        reserveBalance += reserveAmount;

        emit PaymentDistributed(orderId, o.tourId, o.owner, o.guide, total, guideAmount, gosAmount, reserveAmount);
    }
}
