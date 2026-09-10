import { defineConfig } from "hardhat/config";

export default defineConfig({
  solidity: {
    profiles: {
      default: { version: "0.8.34" },
      production: {
        version: "0.8.34",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
});
