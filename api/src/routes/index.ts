import { Router } from "express";

import ingestRouter from "./ingest";

const router = Router();

router.use(ingestRouter);

export default router;
