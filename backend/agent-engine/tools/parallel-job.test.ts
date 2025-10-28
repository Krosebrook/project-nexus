/**
 * Parallel Job Runner Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ParallelJobRunner } from "./parallel-job";

describe("ParallelJobRunner", () => {
  let runner: ParallelJobRunner;

  beforeEach(() => {
    runner = new ParallelJobRunner();
  });

  describe("submitJob", () => {
    it("should submit a data-processing job", async () => {
      const jobSpec = {
        type: "data-processing",
        params: { recordCount: 10000 },
      };

      const submission = await runner.submitJob(jobSpec);

      expect(submission.jobId).toMatch(/^job_/);
      expect(submission.status).toBe("submitted");
      expect(submission.submitTime).toBeInstanceOf(Date);
      expect(submission.estimatedCompletion).toBeInstanceOf(Date);
      expect(submission.progress).toBe(0);
    });

    it("should submit a model-training job", async () => {
      const jobSpec = {
        type: "model-training",
        params: { modelType: "neural-network", epochs: 100 },
        priority: 8,
      };

      const submission = await runner.submitJob(jobSpec);

      expect(submission.jobId).toBeDefined();
      expect(submission.status).toBe("submitted");
    });

    it("should generate unique job IDs", async () => {
      const jobSpec = {
        type: "data-processing",
        params: {},
      };

      const submission1 = await runner.submitJob(jobSpec);
      const submission2 = await runner.submitJob(jobSpec);

      expect(submission1.jobId).not.toBe(submission2.jobId);
    });

    it("should handle job with timeout", async () => {
      const jobSpec = {
        type: "batch-inference",
        params: { sampleCount: 5000 },
        timeout: 60000,
      };

      const submission = await runner.submitJob(jobSpec);

      expect(submission.jobId).toBeDefined();
      expect(submission.status).toBe("submitted");
    });

    it("should estimate completion time", async () => {
      const jobSpec = {
        type: "data-processing",
        params: {},
      };

      const submission = await runner.submitJob(jobSpec);

      expect(submission.estimatedCompletion).toBeDefined();
      if (submission.estimatedCompletion) {
        expect(submission.estimatedCompletion.getTime()).toBeGreaterThan(
          submission.submitTime.getTime()
        );
      }
    });
  });

  describe("checkStatus", () => {
    it("should check status of submitted job", async () => {
      const jobSpec = {
        type: "data-processing",
        params: {},
      };

      const submission = await runner.submitJob(jobSpec);
      const status = await runner.checkStatus(submission.jobId);

      expect(status.jobId).toBe(submission.jobId);
      expect(["submitted", "running", "completed"]).toContain(status.status);
    });

    it("should throw error for non-existent job", async () => {
      await expect(runner.checkStatus("non-existent-job")).rejects.toThrow(
        "Job non-existent-job not found"
      );
    });

    it("should show progress updates", async () => {
      const jobSpec = {
        type: "data-processing",
        params: {},
      };

      const submission = await runner.submitJob(jobSpec);

      // Wait a bit for job to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await runner.checkStatus(submission.jobId);
      expect(status.progress).toBeDefined();
    });
  });

  describe("getResult", () => {
    it("should get result of completed data-processing job", async () => {
      const jobSpec = {
        type: "data-processing",
        params: { recordCount: 5000 },
      };

      const submission = await runner.submitJob(jobSpec);

      // Wait for job to complete
      await new Promise((resolve) => setTimeout(resolve, 5500));

      const result = await runner.getResult(submission.jobId);

      expect(result.jobType).toBe("data-processing");
      expect(result.recordsProcessed).toBe(5000);
      expect(result.outputLocation).toBeDefined();
    }, 10000); // 10 second timeout

    it("should throw error for non-completed job", async () => {
      const jobSpec = {
        type: "data-processing",
        params: {},
      };

      const submission = await runner.submitJob(jobSpec);

      await expect(runner.getResult(submission.jobId)).rejects.toThrow(
        "is not completed"
      );
    });

    it("should throw error for non-existent job", async () => {
      await expect(runner.getResult("non-existent")).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("listJobs", () => {
    it("should list all jobs", async () => {
      const jobSpec1 = { type: "data-processing", params: {} };
      const jobSpec2 = { type: "model-training", params: {} };

      await runner.submitJob(jobSpec1);
      await runner.submitJob(jobSpec2);

      const jobs = await runner.listJobs();

      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter jobs by status", async () => {
      const jobSpec = { type: "data-processing", params: {} };
      await runner.submitJob(jobSpec);

      const submittedJobs = await runner.listJobs("submitted");

      expect(submittedJobs.length).toBeGreaterThan(0);
      submittedJobs.forEach((job) => {
        expect(["submitted", "running"]).toContain(job.status);
      });
    });

    it("should return empty array when no jobs match filter", async () => {
      const jobs = await runner.listJobs("failed");

      expect(Array.isArray(jobs)).toBe(true);
    });
  });

  describe("cancelJob", () => {
    it("should cancel a running job", async () => {
      const jobSpec = {
        type: "model-training",
        params: { epochs: 1000 },
      };

      const submission = await runner.submitJob(jobSpec);

      // Wait a bit for job to start running
      await new Promise((resolve) => setTimeout(resolve, 100));

      await runner.cancelJob(submission.jobId);

      const status = await runner.checkStatus(submission.jobId);
      expect(status.status).toBe("failed");
    });

    it("should throw error for non-existent job", async () => {
      await expect(runner.cancelJob("non-existent")).rejects.toThrow(
        "not found"
      );
    });

    it("should throw error when canceling completed job", async () => {
      const jobSpec = {
        type: "data-export",
        params: {},
      };

      const submission = await runner.submitJob(jobSpec);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 2500));

      await expect(runner.cancelJob(submission.jobId)).rejects.toThrow(
        "Cannot cancel"
      );
    });
  });

  describe("job execution results", () => {
    it("should return correct result for model-training job", async () => {
      const jobSpec = {
        type: "model-training",
        params: { modelType: "cnn", epochs: 50 },
      };

      const submission = await runner.submitJob(jobSpec);
      await new Promise((resolve) => setTimeout(resolve, 10500));

      const result = await runner.getResult(submission.jobId);

      expect(result.jobType).toBe("model-training");
      expect(result.modelType).toBe("cnn");
      expect(result.epochs).toBe(50);
      expect(result.finalAccuracy).toBeDefined();
      expect(result.modelPath).toBeDefined();
    }, 15000); // 15 second timeout

    it("should return correct result for batch-inference job", async () => {
      const jobSpec = {
        type: "batch-inference",
        params: { sampleCount: 3000 },
      };

      const submission = await runner.submitJob(jobSpec);
      await new Promise((resolve) => setTimeout(resolve, 3500));

      const result = await runner.getResult(submission.jobId);

      expect(result.jobType).toBe("batch-inference");
      expect(result.samplesProcessed).toBe(3000);
      expect(result.confidence).toBeDefined();
    });

    it("should return correct result for report-generation job", async () => {
      const jobSpec = {
        type: "report-generation",
        params: { reportType: "quarterly", format: "excel" },
      };

      const submission = await runner.submitJob(jobSpec);
      await new Promise((resolve) => setTimeout(resolve, 4500));

      const result = await runner.getResult(submission.jobId);

      expect(result.jobType).toBe("report-generation");
      expect(result.reportType).toBe("quarterly");
      expect(result.format).toBe("excel");
      expect(result.downloadUrl).toBeDefined();
    });
  });
});
