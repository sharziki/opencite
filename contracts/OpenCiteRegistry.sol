// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title OpenCite Registry
/// @notice Append-only provenance attestations for witnessed book editions and other sources.
/// @dev Stores hashes and minimal citation metadata, never book or source bytes.
contract OpenCiteRegistry {
    uint256 public constant MAX_URI_LENGTH = 512;
    uint256 public constant MAX_LICENSE_LENGTH = 96;

    struct Attestation {
        bytes32 contentHash;
        bytes32 manifestHash;
        string sourceURI;
        string license;
        address attester;
        uint64 registeredAt;
        uint64 revokedAt;
    }

    mapping(bytes32 id => Attestation attestation) private attestations;

    error ZeroContentHash();
    error ZeroManifestHash();
    error EmptySourceURI();
    error EmptyLicense();
    error SourceURITooLong();
    error LicenseTooLong();
    error AlreadyRegistered();
    error AttestationNotFound();
    error NotAttester();
    error AlreadyRevoked();

    event SourceRegistered(
        bytes32 indexed id,
        bytes32 indexed contentHash,
        bytes32 indexed manifestHash,
        address attester,
        string sourceURI,
        string license
    );

    event SourceRevoked(bytes32 indexed id, address indexed attester);

    function register(
        bytes32 contentHash,
        bytes32 manifestHash,
        string calldata sourceURI,
        string calldata license
    ) external returns (bytes32 id) {
        if (contentHash == bytes32(0)) revert ZeroContentHash();
        if (manifestHash == bytes32(0)) revert ZeroManifestHash();
        if (bytes(sourceURI).length == 0) revert EmptySourceURI();
        if (bytes(license).length == 0) revert EmptyLicense();
        if (bytes(sourceURI).length > MAX_URI_LENGTH) revert SourceURITooLong();
        if (bytes(license).length > MAX_LICENSE_LENGTH) revert LicenseTooLong();

        id = computeAttestationId(contentHash, manifestHash, msg.sender);
        if (attestations[id].registeredAt != 0) revert AlreadyRegistered();

        attestations[id] = Attestation({
            contentHash: contentHash,
            manifestHash: manifestHash,
            sourceURI: sourceURI,
            license: license,
            attester: msg.sender,
            registeredAt: uint64(block.timestamp),
            revokedAt: 0
        });

        emit SourceRegistered(id, contentHash, manifestHash, msg.sender, sourceURI, license);
    }

    function revoke(bytes32 id) external {
        Attestation storage attestation = attestations[id];
        if (attestation.registeredAt == 0) revert AttestationNotFound();
        if (attestation.attester != msg.sender) revert NotAttester();
        if (attestation.revokedAt != 0) revert AlreadyRevoked();

        attestation.revokedAt = uint64(block.timestamp);
        emit SourceRevoked(id, msg.sender);
    }

    function getAttestation(bytes32 id) external view returns (Attestation memory) {
        Attestation memory attestation = attestations[id];
        if (attestation.registeredAt == 0) revert AttestationNotFound();
        return attestation;
    }

    function isActive(bytes32 id) external view returns (bool) {
        Attestation memory attestation = attestations[id];
        return attestation.registeredAt != 0 && attestation.revokedAt == 0;
    }

    function computeAttestationId(
        bytes32 contentHash,
        bytes32 manifestHash,
        address attester
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), contentHash, manifestHash, attester));
    }
}
