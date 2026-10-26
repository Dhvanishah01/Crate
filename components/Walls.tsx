import WallDrum from "./WallDrum";
import { getWalls } from "@/lib/db";
import { isOwner } from "@/lib/owner";

export default async function Walls() {
  const [walls, owner] = await Promise.all([getWalls(), isOwner()]);
  return <WallDrum walls={walls} owner={owner} />;
}
