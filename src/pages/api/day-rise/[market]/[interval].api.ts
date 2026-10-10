import type { NextApiRequest, NextApiResponse } from "next";
import mainTrendHandler from "@/services/mainTrendApi";

export const dynamic = "force-dynamic";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return mainTrendHandler(req, res);
}
