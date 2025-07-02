import json
import os
import logging
from openai import OpenAI
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"), 
            base_url="https://api.deepseek.com"
        )
    
    async def categorize_note(self, note_content: str, context_data: dict, existing_categories: List[dict]) -> dict:
        """Categorize a note using AI"""
        try:
            existing_categories_formatted = [f"{cat['category']}: {cat['definition']}" for cat in existing_categories]
            
            system_prompt = """You are an expert knowledge manager who excels at categorizing content. Your goal is to help users organize their knowledge effectively by assigning relevant, meaningful categories.

INSTRUCTIONS:
1. Analyze the note content and identify ALL relevant topics, themes, and concepts
2. Assign 1-4 categories that best represent the content (multiple categories are encouraged for rich content)
3. Use existing categories when they match, create new ones when needed
4. Be creative and specific - help users discover connections they might not see
5. NEVER use "Uncategorized" - every piece of content has some categorizable aspect

RESPONSE FORMATS:

For single category (existing):
{
    "categories": ["Web Development"]
}

For multiple categories (mix of existing and new):
{
    "categories": ["Machine Learning", "Research Methods"],
    "new_categories": [
        {
            "category": "Research Methods",
            "definition": "Methodologies and approaches for conducting research and analysis"
        }
    ]
}

For multiple new categories:
{
    "categories": ["Data Visualization", "Business Intelligence"],
    "new_categories": [
        {
            "category": "Data Visualization", 
            "definition": "Techniques and tools for visual representation of data and insights"
        },
        {
            "category": "Business Intelligence",
            "definition": "Strategic use of data analytics for business decision making"
        }
    ]
}

Always provide meaningful, specific categories that help organize knowledge effectively."""

            # Build context information for better categorization
            context_info = f"URL: {context_data.get('url', '')}"
            if context_data.get('title'):
                context_info += f"\nPage Title: {context_data['title']}"
            if context_data.get('domain'):
                context_info += f"\nWebsite: {context_data['domain']}"
            
            user_prompt = f"""Note Content: "{note_content}"

Webpage Context:
{context_info}

Existing Categories:
{json.dumps(existing_categories_formatted, indent=2)}

Please categorize this note considering both the content and the webpage context, and respond with JSON only."""

            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={'type': 'json_object'},
                temperature=0.1,
                stream=False
            )
            
            raw_response = response.choices[0].message.content
            logger.info("DeepSeek API JSON Response: %s", raw_response)
            
            # Parse the JSON response
            category_data = json.loads(raw_response)
            
            # Validate the response structure
            if "categories" not in category_data:
                raise ValueError("Response missing required 'categories' field")
                
            logger.info("Successfully parsed category data: %s", category_data)
            return category_data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.error(f"Raw response: {raw_response}")
            return {"categories": ["General"], "definition": "JSON parsing failed"}
        except Exception as e:
            logger.error(f"API call error: {e}")
            return {"categories": ["General"], "definition": "API call failed"}

    async def generate_summary(self, content: str, max_length: int = 150) -> str:
        """Generate a summary of the given content"""
        try:
            system_prompt = f"""You are an expert at creating concise, informative summaries. 
            Create a summary of the provided content in {max_length} characters or less. 
            Focus on the key points and main ideas."""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Please summarize this content: {content}"}
                ],
                temperature=0.3,
                max_tokens=50
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return content[:max_length] + "..." if len(content) > max_length else content

    async def extract_keywords(self, content: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from content"""
        try:
            system_prompt = f"""Extract the {max_keywords} most important keywords or phrases from the given content. 
            Return them as a JSON array of strings. Focus on technical terms, proper nouns, and key concepts."""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract keywords from: {content}"}
                ],
                response_format={'type': 'json_object'},
                temperature=0.1
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("keywords", [])
            
        except Exception as e:
            logger.error(f"Error extracting keywords: {e}")
            return []

    async def generate_questions(self, content: str, num_questions: int = 3) -> List[str]:
        """Generate study questions based on content"""
        try:
            system_prompt = f"""Generate {num_questions} thoughtful study questions based on the provided content. 
            The questions should help someone understand and remember the key concepts. 
            Return as a JSON array of strings."""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Generate study questions for: {content}"}
                ],
                response_format={'type': 'json_object'},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("questions", [])
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            return []