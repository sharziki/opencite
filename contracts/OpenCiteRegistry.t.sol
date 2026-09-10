// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {OpenCiteRegistry} from "./OpenCiteRegistry.sol";

contract RevocationCaller {
    function revoke(OpenCiteRegistry registry, bytes32 id) external {
        registry.revoke(id);
    }
}

contract OpenCiteRegistryTest {
    OpenCiteRegistry private registry;

    bytes32 private constant CONTENT_HASH = bytes32(uint256(0x11));
    bytes32 private constant MANIFEST_HASH = bytes32(uint256(0x22));
    string private constant SOURCE_URI = "https://example.org/source.pdf";
    string private constant LICENSE = "CC-BY-4.0";

    function setUp() public {
        registry = new OpenCiteRegistry();
    }

    function test_RegisterImmutableAttestation() public {
        bytes32 id = registry.register(CONTENT_HASH, MANIFEST_HASH, SOURCE_URI, LICENSE);
        OpenCiteRegistry.Attestation memory saved = registry.getAttestation(id);

        require(saved.contentHash == CONTENT_HASH, "content hash mismatch");
        require(saved.manifestHash == MANIFEST_HASH, "manifest hash mismatch");
        require(keccak256(bytes(saved.sourceURI)) == keccak256(bytes(SOURCE_URI)), "source URI mismatch");
        require(keccak256(bytes(saved.license)) == keccak256(bytes(LICENSE)), "license mismatch");
        require(saved.attester == address(this), "attester mismatch");
        require(saved.registeredAt > 0, "timestamp missing");
        require(registry.isActive(id), "attestation not active");
    }

    function test_RevertDuplicateAttestation() public {
        registry.register(CONTENT_HASH, MANIFEST_HASH, SOURCE_URI, LICENSE);

        (bool success,) = address(registry).call(
            abi.encodeCall(registry.register, (CONTENT_HASH, MANIFEST_HASH, SOURCE_URI, LICENSE))
        );
        require(!success, "duplicate registration accepted");
    }

    function test_OnlyOriginalAttesterCanRevoke() public {
        bytes32 id = registry.register(CONTENT_HASH, MANIFEST_HASH, SOURCE_URI, LICENSE);

        RevocationCaller outsider = new RevocationCaller();
        (bool success,) = address(outsider).call(abi.encodeCall(outsider.revoke, (registry, id)));
        require(!success, "outsider revoked attestation");

        registry.revoke(id);
        require(!registry.isActive(id), "revocation not recorded");
    }

    function test_RejectInvalidAndOversizedMetadata() public {
        (bool zeroSuccess,) = address(registry).call(
            abi.encodeCall(registry.register, (bytes32(0), MANIFEST_HASH, SOURCE_URI, LICENSE))
        );
        require(!zeroSuccess, "zero content hash accepted");

        (bool longSuccess,) = address(registry).call(
            abi.encodeCall(registry.register, (CONTENT_HASH, MANIFEST_HASH, string(new bytes(513)), LICENSE))
        );
        require(!longSuccess, "oversized URI accepted");
    }
}
