import { Topic } from "encore.dev/pubsub";
import type { DeploymentNotification } from "./types";

export const deploymentNotificationTopic = new Topic<DeploymentNotification>(
  "deployment-notifications",
  {
    deliveryGuarantee: "at-least-once",
  }
);