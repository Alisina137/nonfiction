import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai/index";
import analysisRouter from "./analysis/index";
import exportRouter from "./export/index";
import bookRouter from "./book/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/analysis", analysisRouter);
router.use("/export", exportRouter);
router.use("/book", bookRouter);

export default router;
