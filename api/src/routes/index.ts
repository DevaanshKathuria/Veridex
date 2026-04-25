import { Router } from "express";

import analyzeRouter from "./analyze";
import ingestRouter from "./ingest";

const router = Router();

router.use(ingestRouter);
router.use(analyzeRouter);

export default router;
