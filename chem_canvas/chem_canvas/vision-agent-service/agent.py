import logging
import os
from dotenv import load_dotenv
from vision_agents.core import User, Agent, cli
from vision_agents.core.agents import AgentLauncher
from vision_agents.plugins import getstream, openai

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

async def create_agent(**kwargs) -> Agent:
    """Create the agent with OpenAI/Gemini Realtime capabilities."""
    
    # Create an agent to run with Stream's edge network
    # Note: Requires STREAM_API_KEY and STREAM_API_SECRET in .env
    agent = Agent(
        edge=getstream.Edge(),  # Stream's low latency edge network
        agent_user=User(
            name="Vision Agent", 
            id="agent_001",
            image="https://getstream.io/static/images/icons/stream-logo.svg"
        ),
        instructions="""
You are a helpful video AI assistant. 
Your goal is to observe the video stream and answer user questions in real-time.
Keep responses concise, friendly, and helpful.
If you see something interesting, point it out!
        """,
        # Defaulting to OpenAI Realtime as per standard docs, 
        # but can be swapped for Gemini if supported by the plugin version
        llm=openai.Realtime(), 
    )
    return agent

async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    """Join the call and start the agent loop."""
    
    # Ensure the agent user exists in Stream
    await agent.create_user()
    
    # Create or get the call
    call = await agent.create_call(call_type, call_id)
    logger.info(f"🤖 Starting Vision Agent on call {call_type}:{call_id}...")
    
    # Join the call
    # This connects the agent to the audio/video stream
    if await agent.join(call):
        logger.info("✅ Joined call successfully")
        
        # Open a simple demo UI (optional, helpful for local testing)
        # expected to open a browser window if running locally
        # await agent.edge.open_demo(call) 
        
        logger.info("🧠 LLM Ready and listening...")
        
        # Initial greeting
        await agent.llm.simple_response("Hello! I am watching the stream. Ask me anything about what I see.")
        
        # Run until the call ends
        await agent.finish()
    else:
        logger.error("❌ Failed to join call")

if __name__ == "__main__":
    # Use the CLI launcher to handle arguments like call_type and call_id
    cli(AgentLauncher(create_agent=create_agent, join_call=join_call))
