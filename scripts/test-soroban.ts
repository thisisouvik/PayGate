import { logReceiptOnChain } from "../apps/web/src/lib/stellar/soroban";
import * as dotenv from "dotenv";
dotenv.config({ path: "./apps/web/.env.local" });

async function run() {
  console.log("Contract ID:", process.env.SOROBAN_CONTRACT_ID);
  
  const txHash = await logReceiptOnChain({
    callerWallet: "GAPOIHPU7BCP5SWZHMHEQ47C7R4OTASY7XL44KHSOMOILVKGAARSZ6WO",
    apiId: "demo-weather",
    amountUsdc: 0.001
  });
  
  console.log("Success! Transaction Hash:", txHash);
}

run();
