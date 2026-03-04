// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BatchTransfer {
    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "length mismatch");
        for (uint i = 0; i < recipients.length; i++) {
            require(IERC20(token).transferFrom(msg.sender, recipients[i], amounts[i]), "transfer failed");
        }
    }
}
