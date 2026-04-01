// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface IRouter {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract PowerUpCHAR {
    address public constant CHAR = 0x20b048fA035D5763685D695e66aDF62c5D9F5055;
    address public constant MFT  = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    IRouter public constant router = IRouter(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);

    event PoweredUp(address indexed nft, address indexed player, uint256 liquidity);

    receive() external payable {}

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "no ETH");

        uint256 half = msg.value / 2;

        // Swap first half ETH -> CHAR
        address[] memory pathA = new address[](2);
        pathA[0] = WETH;
        pathA[1] = CHAR;
        router.swapExactETHForTokens{value: half}(0, pathA, address(this), block.timestamp + 300);

        // Swap remaining ETH -> MfT
        address[] memory pathB = new address[](2);
        pathB[0] = WETH;
        pathB[1] = MFT;
        router.swapExactETHForTokens{value: msg.value - half}(0, pathB, address(this), block.timestamp + 300);

        // Get balances
        uint256 charBal = IERC20(CHAR).balanceOf(address(this));
        uint256 mftBal  = IERC20(MFT).balanceOf(address(this));

        // Approve router for both tokens
        IERC20(CHAR).approve(address(router), charBal);
        IERC20(MFT).approve(address(router), mftBal);

        // Add CHAR/MfT liquidity
        (,, uint256 liquidity) = router.addLiquidity(
            CHAR, MFT,
            charBal, mftBal,
            0, 0,
            address(this),
            block.timestamp + 300
        );

        // Return dust to sender
        uint256 charDust = IERC20(CHAR).balanceOf(address(this));
        uint256 mftDust  = IERC20(MFT).balanceOf(address(this));
        if (charDust > 0) IERC20(CHAR).transfer(msg.sender, charDust);
        if (mftDust > 0)  IERC20(MFT).transfer(msg.sender, mftDust);

        emit PoweredUp(nftContract, msg.sender, liquidity);
    }
}
