import WallSlider from "./WallSlider";
import WallUI from "./WallUI";
import { getWalls } from "@/lib/db";
import { isOwner } from "@/lib/owner";

/** The sleeves, hung inside the room. */
export async function WallSleeves() {
  return <WallSlider walls={await getWalls()} />;
}

/** The wall's name, arrows and the owner's +, outside the room so they don't zoom with it. */
export async function WallPanel() {
  const [walls, owner] = await Promise.all([getWalls(), isOwner()]);
  return <WallUI walls={walls} owner={owner} />;
}
