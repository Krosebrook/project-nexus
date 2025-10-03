import { describe, it, expect } from "vitest";
import { list } from "./list";
import { get } from "./get";
import { create } from "./create";
import { update } from "./update";
import { deleteProject } from "./delete";

describe("Projects API", () => {
  describe("list", () => {
    it("should return array of projects", async () => {
      const result = await list();
      
      expect(result).toHaveProperty("projects");
      expect(Array.isArray(result.projects)).toBe(true);
    });

    it("should return projects ordered by last_activity", async () => {
      const result = await list();
      
      if (result.projects.length > 1) {
        const dates = result.projects.map(p => new Date(p.last_activity).getTime());
        const sortedDates = [...dates].sort((a, b) => b - a);
        expect(dates).toEqual(sortedDates);
      }
    });
  });

  describe("get", () => {
    it("should return project by id", async () => {
      const allProjects = await list();
      
      if (allProjects.projects.length > 0) {
        const projectId = allProjects.projects[0].id;
        const result = await get({ id: projectId });
        
        expect(result).toHaveProperty("id", projectId);
        expect(result).toHaveProperty("name");
        expect(result).toHaveProperty("status");
      }
    });

    it("should throw error for non-existent project", async () => {
      await expect(async () => {
        await get({ id: 999999 });
      }).rejects.toThrow();
    });
  });

  describe("create", () => {
    it("should create new project with valid data", async () => {
      const newProject = {
        name: `Test Project ${Date.now()}`,
        description: "Test Description",
        status: "development" as const,
      };

      const result = await create(newProject);
      
      expect(result).toHaveProperty("id");
      expect(result.name).toBe(newProject.name);
      expect(result.description).toBe(newProject.description);
      expect(result.status).toBe(newProject.status);
    });
  });

  describe("update", () => {
    it("should update project successfully", async () => {
      const allProjects = await list();
      
      if (allProjects.projects.length > 0) {
        const project = allProjects.projects[0];
        const updates = {
          id: project.id,
          name: `Updated Name ${Date.now()}`,
          description: project.description || undefined,
          status: project.status,
        };

        const result = await update(updates);
        
        expect(result.name).toContain("Updated Name");
      }
    });
  });

  describe("delete", () => {
    it("should delete project successfully", async () => {
      const newProject = await create({
        name: "To Delete",
        description: "Will be deleted",
        status: "development",
      });

      const result = await deleteProject({ id: newProject.id });
      
      expect(result.success).toBe(true);
    });
  });
});
