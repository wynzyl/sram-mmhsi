/**
 * Liveness probe endpoint for container orchestration (Kubernetes/ECS).
 * Returns 200 if the application process is running.
 */
export async function GET() {
  return Response.json({
    status: "healthy",
    timestamp: Date.now(),
  });
}
