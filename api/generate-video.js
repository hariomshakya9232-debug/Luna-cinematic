export default async function handler(req, res) {
  const MODEL = "fal-ai/kling-video/v3/standard/text-to-video";
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return res.status(500).json({
      error: "FAL_KEY is not configured"
    });
  }

  try {
    // Generate a new video
    if (req.method === "POST") {
      const {
        prompt,
        duration = "5",
        generate_audio = true,
        aspect_ratio = "9:16"
      } = req.body || {};

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({
          error: "Prompt is required"
        });
      }

      const response = await fetch(
        `https://queue.fal.run/${MODEL}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Key ${FAL_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            duration: String(duration),
            generate_audio: Boolean(generate_audio),
            aspect_ratio
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json({
        success: true,
        request_id: data.request_id
      });
    }

    // Check video generation status
    if (req.method === "GET") {
      const requestId = req.query?.request_id;

      if (!requestId) {
        return res.status(400).json({
          error: "request_id is required"
        });
      }

      const statusResponse = await fetch(
        `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(requestId)}/status`,
        {
          headers: {
            "Authorization": `Key ${FAL_KEY}`
          }
        }
      );

      const statusData = await statusResponse.json();

      if (!statusResponse.ok) {
        return res.status(statusResponse.status).json(statusData);
      }

      if (statusData.status === "COMPLETED") {
        const resultResponse = await fetch(
          `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(requestId)}/response`,
          {
            headers: {
              "Authorization": `Key ${FAL_KEY}`
            }
          }
        );

        const resultData = await resultResponse.json();

        return res.status(200).json({
          success: true,
          status: "COMPLETED",
          result: resultData
        });
      }

      return res.status(200).json({
        success: true,
        status: statusData.status,
        queue_position: statusData.queue_position || null
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Video generation request failed"
    });
  }
          }
