// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRouter {
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory);
    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint, uint, uint);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint);
    function approve(address, uint) external returns (bool);
    function transfer(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
}

/// @title PowerUp PKT/PR25 — Polygon
/// @notice WETH → split → half PKT + half PR25 → add PKT/PR25 LP → NFT contract
contract PowerUpPKTPR25_Polygon {
    IRouter public constant router = IRouter(0xedf6066a2b290C185783862C7F4776A2C8077AD1);
    address public constant WETH  = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
    address public constant PKT   = 0x8a088dCEEcbCF457762EB7C66F78ffF27dC0C04a;
    address public constant PR25  = 0x72E4327F592E9Cb09d5730a55D1D68De144aF53C;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract, uint wethAmount) external {
        require(wethAmount > 0, "No WETH");
        IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);

        _swapHalf(wethAmount / 2, PKT);
        _swapHalf(wethAmount - wethAmount / 2, PR25);

        uint balPkt  = IERC20(PKT).balanceOf(address(this));
        uint balPr25 = IERC20(PR25).balanceOf(address(this));
        IERC20(PKT).approve(address(router), balPkt);
        IERC20(PR25).approve(address(router), balPr25);

        (,, uint liq) = router.addLiquidity(
            PKT, PR25, balPkt, balPr25, 0, 0,
            nftContract, block.timestamp + 300
        );

        _refundDust(PKT);
        _refundDust(PR25);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    function _swapHalf(uint amount, address tokenOut) internal {
        IERC20(WETH).approve(address(router), amount);
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = tokenOut;
        router.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp + 300);
    }

    function _refundDust(address token) internal {
        uint bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(msg.sender, bal);
    }
}
