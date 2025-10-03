import { useEffect, useState, useRef } from "react";
import backend from "~backend/client";
import { Card } from "@/components/ui/card";
import { GitBranch, AlertCircle } from "lucide-react";

interface Node {
  id: number;
  name: string;
  x?: number;
  y?: number;
}

interface Edge {
  from: number;
  to: number;
  type: string;
}

interface DependencyGraphProps {
  projectId: number;
}

export function DependencyGraph({ projectId }: DependencyGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadGraph();
  }, [projectId]);

  useEffect(() => {
    if (nodes.length > 0) {
      layoutNodes();
      drawGraph();
    }
  }, [nodes, edges]);

  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      const graphRes = await backend.deployments.getDependencyGraph({ projectId });
      setNodes(graphRes.nodes);
      setEdges(graphRes.edges);
    } catch (err) {
      console.error("Failed to load dependency graph:", err);
      setError("Failed to load dependency graph");
    } finally {
      setLoading(false);
    }
  };

  const layoutNodes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const updatedNodes = nodes.map((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    setNodes(updatedNodes);
  };

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);

      if (fromNode?.x && fromNode?.y && toNode?.x && toNode?.y) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        
        const isDev = edge.type === "dev";
        ctx.strokeStyle = isDev ? "rgba(156, 163, 175, 0.4)" : "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = isDev ? 1 : 2;
        ctx.setLineDash(isDev ? [5, 5] : []);
        ctx.stroke();

        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const arrowSize = 8;
        const arrowX = toNode.x - 25 * Math.cos(angle);
        const arrowY = toNode.y - 25 * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    });

    nodes.forEach(node => {
      if (node.x && node.y) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = node.id === projectId ? "rgb(59, 130, 246)" : "rgb(71, 85, 105)";
        ctx.fill();
        ctx.strokeStyle = "rgb(255, 255, 255)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.name.substring(0, 15), node.x, node.y + 35);
      }
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Loading dependency graph...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="h-96 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <AlertCircle className="w-8 h-8" />
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  if (nodes.length === 0) {
    return (
      <Card className="p-6">
        <div className="h-96 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <GitBranch className="w-8 h-8" />
          <p>No dependencies found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Project Dependencies</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500"></div>
              <span className="text-muted-foreground">Direct</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 border-t border-dashed border-muted-foreground"></div>
              <span className="text-muted-foreground">Dev</span>
            </div>
          </div>
        </div>
        
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-auto bg-background border rounded-lg"
        />
        
        <div className="text-sm text-muted-foreground">
          {nodes.length} {nodes.length === 1 ? 'project' : 'projects'}, {edges.length} {edges.length === 1 ? 'dependency' : 'dependencies'}
        </div>
      </div>
    </Card>
  );
}