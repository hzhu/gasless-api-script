import { trade } from "./lib";

try {
  await trade({
    sellAmount: "846925725410518",
    sellToken: "0x2416092f143378750bb29b79ed961ab195cceea5",
    buyToken: "0xdfc7c877a950e49d2610114102175a06c2e3167a",
    taker: "0x8a6bfcae15e729fd1440574108437dea281a9b3e",
  });
} catch (error) {
  console.log(error);
}
