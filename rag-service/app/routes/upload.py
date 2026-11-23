
import os
import shutil
import tempfile
import httpx

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

from app.services.ingest import IngestionService
from app.services import vector_store


# Upload router initialize kar rahe hain
router = APIRouter(
    prefix="/upload",
    tags=["Multi-Modal Ingestion"]
)


# Temporary uploaded files ke liye directory create kar rahe hain
TEMP_DIR = "./temp_files"
os.makedirs(TEMP_DIR, exist_ok=True)


# URL se file ingestion ke liye request body ka structure define kar rahe hain
class IngestFromUrlRequest(BaseModel):
    file_url: str
    filename: str = "uploaded_file"


# Local browser input se upload hone wali file ko handle kar rahe hain
@router.post("/")
async def upload_file(file: UploadFile = File(...)):

    # Uploaded file ka temporary path generate kar rahe hain
    file_path = os.path.join(TEMP_DIR, file.filename)

    try:

        # File ko temporarily server ke local folder mein save kar rahe hain
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Multi-modal ingestion service call karke Vector DB mein store kar rahe hain
        result = IngestionService.process_file(file_path, file.filename)

        return result

    except Exception as e:

        # Upload ya ingestion fail hone par error return kar rahe hain
        raise HTTPException(status_code=500, detail=str(e))

    finally:

        # Processing complete hone ke baad temporary file delete kar rahe hain
        if os.path.exists(file_path):
            os.remove(file_path)


# Cloudinary ya kisi external URL se file download karke Vector DB mein ingest kar rahe hain
@router.post("/from-url")
async def upload_from_url(payload: IngestFromUrlRequest):

    # Temporary downloaded file ka path initially None rakha hai
    tmp_path = None

    try:

        # Filename se extension extract kar rahe hain, extension na mile toh .bin use karenge
        ext = os.path.splitext(payload.filename)[1] or ".bin"

        # External URL se file download karne ke liye asynchronous HTTP client use kar rahe hain
        async with httpx.AsyncClient(
            timeout=60.0,
            follow_redirects=True
        ) as client:

            # Provided URL se actual file download kar rahe hain
            response = await client.get(payload.file_url)

            # Agar download request fail hoti hai toh HTTP error raise hoga
            response.raise_for_status()

        # Downloaded file ko temporary location par save kar rahe hain
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=ext
        ) as tmp:

            # Downloaded file ka content temporary file mein write kar rahe hain
            tmp.write(response.content)

            # Temporary file ka path store kar rahe hain
            tmp_path = tmp.name

        # Existing ingestion service ko downloaded file ka path aur original filename pass kar rahe hain
        result = IngestionService.process_file(
            tmp_path,
            payload.filename
        )

        # Successful ingestion ka result frontend ko return kar rahe hain
        return result

    except httpx.HTTPError as e:

        # URL se file download nahi hone par client error return kar rahe hain
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download file from URL: {str(e)}"
        )

    except ValueError as e:

        # Invalid file ya ingestion input hone par validation error return kar rahe hain
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        # Unexpected ingestion error hone par server error return kar rahe hain
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {str(e)}"
        )

    finally:

        # Ingestion complete hone ke baad downloaded temporary file remove kar rahe hain
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


# Naye session ke liye ChromaDB aur existing chat context reset kar rahe hain
@router.post("/reset")
def reset_session():

    """Naye session ke liye ChromaDB aur chat context ko completely wipe out karta hai."""

    try:

        # Vector store ka reset function execute kar rahe hain
        success = vector_store.reset_store()

        # Reset unsuccessful hone par error return kar rahe hain
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to reset vector database."
            )

        # Successful reset ka confirmation frontend ko return kar rahe hain
        return {
            "status": "success",
            "message": "ChromaDB successfully wiped. Ready for a new session!"
        }

    except Exception as e:

        # Reset process mein exception aane par error handle kar rahe hain
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
