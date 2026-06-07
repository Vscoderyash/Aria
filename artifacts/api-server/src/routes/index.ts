import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import agentsRouter from "./agents";
import memoryRouter from "./memory";
import repositoriesRouter from "./repositories";
import ownerRouter from "./owner";
import aiRouter from "./ai";
import githubRouter from "./github";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(agentsRouter);
router.use(memoryRouter);
router.use(repositoriesRouter);
router.use(ownerRouter);
router.use(aiRouter);
router.use(githubRouter);

export default router;
