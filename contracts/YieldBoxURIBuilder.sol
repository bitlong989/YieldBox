// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import "@openzeppelin/contracts/utils/Strings.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/Base64.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "./interfaces/IYieldBox.sol";

contract YieldBoxURIBuilder {
    using BoringERC20 for IERC20;
    using Strings for uint256;
    using Base64 for bytes;

    IYieldBox public yieldBox;

    function setYieldBox() public {
        require(address(yieldBox) == address(0), "YieldBox already set");
        yieldBox = IYieldBox(payable(msg.sender));
    }

    struct AssetDetails {
        string tokenType;
        string name;
        string symbol;
        uint256 decimals;
    }

    function uri(uint256 assetId) external view returns (string memory) {
        AssetDetails memory details;
        (TokenType tokenType, address contractAddress, IStrategy strategy, uint256 tokenId) = yieldBox.assets(assetId);
        if (tokenType == TokenType.ERC1155) {
            // Contracts can't retrieve URIs, so the details are out of reach
            details.tokenType = "ERC1155";
            details.name = string(
                abi.encodePacked("ERC1155: ", uint256(uint160(contractAddress)).toHexString(20), ", tokenID: ", tokenId.toString())
            );
            details.symbol = "ERC1155";
        } else if (tokenType == TokenType.ERC20) {
            IERC20 token = IERC20(contractAddress);
            details = AssetDetails("ERC20", token.safeName(), token.safeSymbol(), token.safeDecimals());
        } else if (tokenType == TokenType.Native) {
            details.tokenType = "Native";
            (details.name, details.symbol, details.decimals) = yieldBox.nativeTokens(assetId);
        }

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    abi
                        .encodePacked(
                            "{'name':'",
                            details.name,
                            "','symbol':'",
                            details.symbol,
                            tokenType == TokenType.ERC1155 ? "" : "','decimals':",
                            tokenType == TokenType.ERC1155 ? "" : details.decimals.toString(),
                            ",'properties':{'strategy':'",
                            uint256(uint160(address(strategy))).toHexString(20),
                            "'}}"
                        )
                        .encode()
                )
            );
    }
}