import { Subscription } from "encore.dev/pubsub";
import { deploymentNotificationTopic } from "./topics";
import db from "../db";

new Subscription(deploymentNotificationTopic, "log-deployment-events", {
  handler: async (event) => {
    await db.exec`
      INSERT INTO activity_log (
        project_id, 
        action_type, 
        entity_type, 
        entity_id, 
        description, 
        metadata
      ) VALUES (
        ${event.projectId},
        'deployment_notification',
        'deployment',
        ${event.deploymentId},
        ${event.message || `Deployment ${event.status}`},
        ${JSON.stringify({
          status: event.status,
          stage: event.stage,
          progress: event.progress,
          environmentName: event.environmentName,
        })}
      )
    `;
  },
});