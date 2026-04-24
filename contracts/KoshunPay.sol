pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract KoshunPay {
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
    event PaymentReceived(
        uint256 indexed orderId,
        uint256 indexed tourId,
        address indexed tourist,
        uint256 amount,
        uint64 releaseTime
    );
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

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address paymentTokenAddress, address gosAddress_) {
        require(paymentTokenAddress != address(0), "TOKEN_ZERO");
        require(gosAddress_ != address(0), "GOS_ZERO");
        owner = msg.sender;
        paymentToken = IERC20(paymentTokenAddress);
        gosAddress = gosAddress_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit GosAddressChanged(address(0), gosAddress_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNER_ZERO");
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    function setGosAddress(address newGosAddress) external onlyOwner {
        require(newGosAddress != address(0), "GOS_ZERO");
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
        require(bytes(header).length != 0, "HEADER_EMPTY");
        require(bytes(description).length != 0, "DESC_EMPTY");
        require(bytes(image).length != 0, "IMAGE_EMPTY");
        require(price != 0, "PRICE_ZERO");
        require(seatsTotal != 0, "SEATS_ZERO");

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
        require(t.guide != address(0), "TOUR_NOT_FOUND");

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
        require(o.owner != address(0), "ORDER_NOT_FOUND");
        Dispute storage d = disputes[orderId];
        tourId = o.tourId;
        orderOwner = o.owner;
        guide = o.guide;
        amount = o.amount;
        paidAt = o.paidAt;
        releaseTime = o.releaseTime;
        status = o.status;
        isProcessed = o.isProcessed;
        isDisputed = o.isDisputed;
        disputeStatus = d.status;
    }

    function getMyActiveBookedOrderIds(address user) external view returns (uint256[] memory) {
        uint256[] storage ids = userOrderIds[user];
        uint256 count;
        for (uint256 i; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (o.owner != user) continue;
            if (o.status == OrderStatus.Refunded || o.status == OrderStatus.None) continue;
            Tour storage t = tours[o.tourId];
            if (!_isTourActive(t)) continue;
            count++;
        }
        uint256[] memory out = new uint256[](count);
        uint256 j;
        for (uint256 i; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (o.owner != user) continue;
            if (o.status == OrderStatus.Refunded || o.status == OrderStatus.None) continue;
            Tour storage t = tours[o.tourId];
            if (!_isTourActive(t)) continue;
            out[j++] = ids[i];
        }
        return out;
    }

    function pay(uint256 tourId) external returns (uint256 orderId) {
        require(isTourist(msg.sender), "ONLY_TOURIST");

        Tour storage t = tours[tourId];
        require(t.guide != address(0), "TOUR_NOT_FOUND");
        require(_isTourActive(t), "TOUR_INACTIVE");
        require(orderIdByTourAndOwner[tourId][msg.sender] == 0, "ALREADY_BOOKED");

        t.seatsRemaining -= 1;
        if (t.seatsRemaining == 0) {
            t.deadline = uint64(block.timestamp);
        }

        require(paymentToken.transferFrom(msg.sender, address(this), t.price), "TRANSFER_FROM_FAIL");

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
        require(o.owner != address(0), "ORDER_NOT_FOUND");
        require(msg.sender == o.owner, "ONLY_ORDER_OWNER");
        require(o.status == OrderStatus.Paid, "NOT_PAID");
        require(!o.isProcessed, "ALREADY_PROCESSED");
        require(block.timestamp >= o.releaseTime, "TOO_EARLY");
        require(!o.isDisputed, "DISPUTED");
        require(disputes[orderId].status == DisputeStatus.None, "DISPUTE_ACTIVE");

        _internalDistribute(orderId);
    }

    function confirmAll(uint256 maxCount) external onlyOwner returns (uint256 processed) {
        uint256 i;
        while (i < pendingOrders.length && processed < maxCount) {
            uint256 orderId = pendingOrders[i];
            Order storage o = orders[orderId];
            if (o.owner == address(0)) {
                _removePending(orderId);
                continue;
            }

            bool eligible = (o.status == OrderStatus.Paid) && (!o.isProcessed) && (!o.isDisputed)
                && (disputes[orderId].status == DisputeStatus.None) && (block.timestamp >= o.releaseTime);

            if (!eligible) {
                i++;
                continue;
            }

            _internalDistribute(orderId);
            processed++;
        }
    }

    function openDispute(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.owner != address(0), "ORDER_NOT_FOUND");
        require(msg.sender == o.owner, "ONLY_ORDER_OWNER");
        require(o.status == OrderStatus.Paid, "NOT_PAID");
        require(!o.isProcessed, "ALREADY_PROCESSED");
        require(disputes[orderId].status == DisputeStatus.None, "DISPUTE_EXISTS");

        disputes[orderId] = Dispute({status: DisputeStatus.Pending, createdAt: uint64(block.timestamp), resolvedAt: 0});
        o.status = OrderStatus.Disputed;
        o.isDisputed = true;

        emit DisputeOpened(orderId, o.tourId, msg.sender);
    }

    function resolveDispute(uint256 orderId, bool approve) external onlyOwner {
        Order storage o = orders[orderId];
        require(o.owner != address(0), "ORDER_NOT_FOUND");

        Dispute storage d = disputes[orderId];
        require(d.status == DisputeStatus.Pending, "NOT_PENDING");

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
            _internalDistribute(orderId);
        }
    }

    function refund(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.owner != address(0), "ORDER_NOT_FOUND");
        require(msg.sender == o.owner, "ONLY_ORDER_OWNER");
        require(disputes[orderId].status == DisputeStatus.Approved, "NOT_APPROVED");
        require(!o.isProcessed, "ALREADY_PROCESSED");
        require(o.status == OrderStatus.Disputed, "NOT_DISPUTED");

        o.status = OrderStatus.Refunded;
        o.isProcessed = true;
        o.isDisputed = false;
        _removePending(orderId);

        require(paymentToken.transfer(msg.sender, o.amount), "TRANSFER_FAIL");
        emit RefundExecuted(orderId, msg.sender, o.amount);
    }

    function transferBooking(uint256 orderId, address newOwner) external {
        require(newOwner != address(0), "NEW_OWNER_ZERO");
        require(newOwner != msg.sender, "NEW_OWNER_SELF");
        require(newOwner != gosAddress, "NEW_OWNER_GOS");
        require(!isGuide[newOwner], "NEW_OWNER_GUIDE");

        Order storage o = orders[orderId];
        require(o.owner != address(0), "ORDER_NOT_FOUND");
        require(msg.sender == o.owner, "ONLY_ORDER_OWNER");
        require(!o.isDisputed, "DISPUTED");
        require(disputes[orderId].status == DisputeStatus.None, "DISPUTE_ACTIVE");

        require(o.status == OrderStatus.Completed, "NOT_COMPLETED");
        require(o.isProcessed, "NOT_PROCESSED");

        uint256 tourId = o.tourId;
        require(orderIdByTourAndOwner[tourId][newOwner] == 0, "NEW_OWNER_HAS_ORDER");

        address prevOwner = o.owner;
        o.owner = newOwner;

        orderIdByTourAndOwner[tourId][prevOwner] = 0;
        orderIdByTourAndOwner[tourId][newOwner] = orderId;
        userOrderIds[newOwner].push(orderId);

        emit BookingTransferred(orderId, tourId, prevOwner, newOwner);
    }

    function withdrawGuide() external {
        require(isGuide[msg.sender], "ONLY_GUIDE");
        uint256 amount = guideBalance[msg.sender];
        require(amount != 0, "ZERO_BAL");
        guideBalance[msg.sender] = 0;
        require(paymentToken.transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawGos() external {
        require(msg.sender == gosAddress, "ONLY_GOS");
        uint256 amount = gosBalance;
        require(amount != 0, "ZERO_BAL");
        gosBalance = 0;
        require(paymentToken.transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawReserve() external onlyOwner {
        uint256 amount = reserveBalance;
        require(amount != 0, "ZERO_BAL");
        reserveBalance = 0;
        require(paymentToken.transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit Withdrawn(msg.sender, amount);
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

    function _internalDistribute(uint256 orderId) internal {
        Order storage o = orders[orderId];
        require(o.status == OrderStatus.Paid, "NOT_PAID");
        require(!o.isProcessed, "ALREADY_PROCESSED");
        require(!o.isDisputed, "DISPUTED");
        require(disputes[orderId].status == DisputeStatus.None, "DISPUTE_ACTIVE");

        o.status = OrderStatus.Completed;
        o.isProcessed = true;
        _removePending(orderId);

        uint256 total = o.amount;
        uint256 guideAmount = (total * 85) / 100;
        uint256 gosAmount = (total * 10) / 100;
        uint256 reserveAmount = total - guideAmount - gosAmount;

        guideBalance[o.guide] += guideAmount;
        gosBalance += gosAmount;
        reserveBalance += reserveAmount;

        emit PaymentDistributed(
            orderId, o.tourId, o.owner, o.guide, total, guideAmount, gosAmount, reserveAmount
        );
    }
}
