import type { NextApiRequest, NextApiResponse } from "next";
import cron from "node-cron";
import dayjs from "dayjs";
import { fetchAMainTrend } from "@/pages/utils/fetchMainTrendAndSendEmail";
import { EReqType } from "@/pages/utils/config";
import { MainTrendConfigs, type IMainTrendConditionConfig } from "@/pages/utils/mainTrendConfig";
import { EJobType, EMarketType } from "@/services/models/SchedulerLog";
import SchedulerService, { type ISchedulerContext } from "@/services/schedulerService";

export type MainTrendMarket = "a" | "hk" | "us";
export type MainTrendInterval = "day" | "60m" | "30m";

type MainTrendKey = `${MainTrendMarket}/${MainTrendInterval}`;
type MainTrendTask = ReturnType<typeof cron.schedule>;

const cronExpression = "0 2 * * 1-5";
const tasks = new Map<MainTrendKey, MainTrendTask>();

const configMap: Record<MainTrendKey, IMainTrendConditionConfig> = {
  "a/day": MainTrendConfigs.A_DAY_MAIN_TREND,
  "a/60m": MainTrendConfigs.A_MIN_60_MAIN_TREND,
  "a/30m": MainTrendConfigs.A_MIN_30_MAIN_TREND,
  "hk/day": MainTrendConfigs.HK_DAY_MAIN_TREND,
  "hk/60m": MainTrendConfigs.HK_MIN_60_MAIN_TREND,
  "hk/30m": MainTrendConfigs.HK_MIN_30_MAIN_TREND,
  "us/day": MainTrendConfigs.US_DAY_MAIN_TREND,
  "us/60m": MainTrendConfigs.US_MIN_60_MAIN_TREND,
  "us/30m": MainTrendConfigs.US_MIN_30_MAIN_TREND,
};

const marketMap: Record<MainTrendMarket, EMarketType> = {
  a: EMarketType.A,
  hk: EMarketType.HK,
  us: EMarketType.US,
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getTaskKey(req: NextApiRequest): MainTrendKey | null {
  const market = getParam(req.query.market);
  const interval = getParam(req.query.interval);
  if (!market || !interval || !( `${market}/${interval}` in configMap)) return null;
  return `${market}/${interval}` as MainTrendKey;
}

function isImmediate(req: NextApiRequest) {
  const value = getParam(req.query.isImmediately);
  return value === "true" || value === "1";
}

function getContext(key: MainTrendKey, isManual: boolean, triggeredBy?: string): ISchedulerContext {
  const market = key.split("/")[0] as MainTrendMarket;
  const interval = key.split("/")[1];
  const apiPath = `/api/day-rise/${key}`;
  return {
    jobName: `${SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, marketMap[market])}_${interval.toUpperCase()}`,
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: marketMap[market],
    apiPath,
    cronExpression,
    isManual,
    triggeredBy,
  };
}

async function executeTask(key: MainTrendKey, config: IMainTrendConditionConfig, isManual: boolean, triggeredBy?: string) {
  const context = getContext(key, isManual, triggeredBy);
  return SchedulerService.executeWithLogging(context, () =>
    fetchAMainTrend({
      reqType: EReqType.EASY_MONEY,
      currentDate: dayjs(),
      sendEmail: true,
      stockType: config.marketType,
      config,
    }),
  );
}

export default async function mainTrendHandler(req: NextApiRequest, res: NextApiResponse) {
  const key = getTaskKey(req);
  if (!key) {
    return res.status(400).json({
      success: false,
      message: "Invalid main-trend market or interval",
      allowed: Object.keys(configMap),
    });
  }

  const config = configMap[key];
  const [market, interval] = key.split("/") as [MainTrendMarket, MainTrendInterval];
  const task = tasks.get(key);

  if (req.method === "GET") {
    if (!task) {
      tasks.set(
        key,
        cron.schedule(cronExpression, async () => {
          try {
            await executeTask(key, config, false);
          } catch (error) {
            console.error(`[main-trend:${key}] scheduled task failed`, error);
          }
        }, { timezone: "Asia/Shanghai", scheduled: true }),
      );
    }

    const data = isImmediate(req)
      ? await executeTask(key, config, true, String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown"))
      : undefined;

    return res.status(200).json({
      success: true,
      message: `主涨段任务已启动 [${config.name}]`,
      market,
      interval,
      config_name: config.name,
      schedule: "工作日 02:00",
      conditions: {
        condition1: config.macd.description,
        condition2: config.ma.description,
        condition3: config.boll.description,
      },
      data,
      monitoring: { enabled: true, key },
    });
  }

  if (req.method === "DELETE") {
    if (task) {
      task.stop();
      tasks.delete(key);
    }
    return res.status(200).json({
      success: true,
      message: `主涨段任务已停止 [${config.name}]`,
      market,
      interval,
      config_name: config.name,
      stopped: Boolean(task),
    });
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
}
