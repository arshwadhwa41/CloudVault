import os
import uuid
import base64
import cv2

from pypdf import PdfReader
from groq import Groq
from huggingface_hub import InferenceClient

from app.config import settings
from app.services.vector_store import vector_store


# ============================================================
# CLIENT INITIALIZATION
# ============================================================

groq_client = Groq(api_key=settings.GROQ_API_KEY)
hf_client = InferenceClient(api_key=settings.HF_API_KEY)


# ============================================================
# INGESTION SERVICE (HYBRID MULTI-MODAL PIPELINE)
# ============================================================

class IngestionService:

    # --------------------------------------------------------
    # IMAGE TO BASE64 CONVERSION
    # --------------------------------------------------------

    @staticmethod
    def encode_image_to_base64(image_path: str) -> str:
        """Image ko Base64 encoded string mein convert karta hai."""
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
        return base64.b64encode(image_data).decode("utf-8")


    # --------------------------------------------------------
    # IMAGE PROCESSING USING GROQ VISION MODEL
    # --------------------------------------------------------

    @staticmethod
    def process_image(file_path: str, original_filename: str = "") -> str:
        """Groq Vision Model (qwen/qwen3.8-27b) ka use karke image ko deeply analyze karta hai."""
        base64_image = IngestionService.encode_image_to_base64(file_path)
        clean_name = os.path.basename(original_filename if original_filename else file_path)

        prompt_text = (
            f"You are analyzing an image file named '{clean_name}' for a high-end RAG knowledge base. "
            "Provide a comprehensive, highly detailed description of this image. "
            "Extract all readable text, labels, titles, UI/UX elements, prominent subjects, objects, branding, "
            "and contextual details so that an AI can answer any complex query about it."
        )

        response = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=512
        )
        
        vision_output = response.choices[0].message.content
        return f"--- Image Analysis Record ---\nFile: {clean_name}\n\n{vision_output}"


    # --------------------------------------------------------
    # PDF PROCESSING
    # --------------------------------------------------------

    @staticmethod
    def process_pdf(file_path: str, original_filename: str = "") -> list[str]:
        """PDF ke har page ya sections ko chunk karke list return karta hai."""
        reader = PdfReader(file_path)
        clean_name = os.path.basename(original_filename if original_filename else file_path)
        chunks = []
        
        for page_num, page in enumerate(reader.pages):
            extracted = page.extract_text()
            if extracted and extracted.strip():
                chunk_text = f"--- Document Record ---\nFile: {clean_name}\nPage: {page_num + 1}\n\n{extracted.strip()}"
                chunks.append(chunk_text)

        return chunks if chunks else [f"Document Record: {clean_name} (Empty PDF)"]


    # --------------------------------------------------------
    # AUDIO PROCESSING (HYBRID RICH METADATA)
    # --------------------------------------------------------

    @staticmethod
    def process_audio(file_path: str, original_filename: str = "") -> str:
        """Audio file ki properties aur filename se rich semantic context generate karta hai."""
        clean_name = os.path.basename(original_filename if original_filename else file_path)
        
        audio_description = (
            f"--- Audio File Record ---\n"
            f"File Name: {clean_name}\n"
            f"Media Type: Audio Track / Song / Recording\n"
            f"Contextual Details: This audio file represents a media track or recording named '{clean_name}'. "
            f"If it is a known song, soundtrack, or voice clip, it contains rich cultural, lyrical, or conversational elements. "
            f"Use the file name indicators (such as artist, movie, or title keywords present in '{clean_name}') to identify its full context, "
            f"lyrics, background details, and publishing information."
        )
        return audio_description


    # --------------------------------------------------------
    # VIDEO PROCESSING
    # --------------------------------------------------------

    @staticmethod
    def process_video(file_path: str, original_filename: str = "") -> str:
        """Video se key frames extract karke aur audio metadata combine karke rich summary banata hai."""
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise ValueError("Video file ko open nahi kiya ja saka!")

        clean_name = os.path.basename(original_filename if original_filename else file_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        frame_indices = [
            0,
            int(total_frames / 2),
            max(0, total_frames - 1)
        ]

        frame_description = []

        for idx, frame_idx in enumerate(frame_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()

            if ret:
                temp_frame_path = f"temp_frame_{idx}.jpg"
                cv2.imwrite(temp_frame_path, frame)

                try:
                    desc = IngestionService.process_image(temp_frame_path, clean_name)
                    frame_description.append(
                        f"Frame {idx + 1} (Timestamp: {frame_idx / fps:.1f}s):\n{desc}"
                    )
                except Exception as e:
                    frame_description.append(
                        f"Frame {idx + 1}: [Extraction Error: {str(e)}]"
                    )
                finally:
                    if os.path.exists(temp_frame_path):
                        os.remove(temp_frame_path)

        cap.release()

        audio_metadata = IngestionService.process_audio(file_path, clean_name)

        combined_content = (
            f"--- Video Media Record ---\n"
            f"File: {clean_name}\n\n"
            f"=== Visual Frame Summaries ===\n" + "\n\n".join(frame_description) + "\n\n"
            f"=== Audio / Track Metadata ===\n" + audio_metadata
        )
        return combined_content


    # --------------------------------------------------------
    # MAIN FILE PROCESSING FUNCTION
    # --------------------------------------------------------

    @classmethod
    def process_file(cls, file_path: str, original_filename: str) -> dict:
        # Single-file session workflow: nayi file ingest karne se pehle purana context wipe karo
        reset_ok = vector_store.reset_store()
        if not reset_ok:
            print("Warning: Vector store reset returned False before ingesting new file.")

        ext = original_filename.lower().split(".")[-1]
        if ext in ["pdf"]:
            extracted_chunks = cls.process_pdf(file_path, original_filename)
            if not extracted_chunks:
                raise ValueError("PDF ke andar koi content extract nahi ho paya!")

            doc_id = str(uuid.uuid4())
            metadata = {
                "source": original_filename,
                "type": ext
            }

            # Har page/chunk ko vector store mein alag se add karenge
            for i, chunk in enumerate(extracted_chunks):
                vector_store.add_document(
                    doc_id=f"{doc_id}_page_{i+1}",
                    text=chunk,
                    metadata=metadata
                )

            return {
                "doc_id": doc_id,
                "filename": original_filename,
                "file_type": ext,
                "status": "success",
                "message": "PDF successfully processed in chunks and stored in vector database!"
            }

        else:
            extracted_text = ""
            if ext in ["png", "jpg", "jpeg", "webp"]:
                extracted_text = cls.process_image(file_path, original_filename)
            elif ext in ["mp3", "wav", "m4a"]:
                extracted_text = cls.process_audio(file_path, original_filename)
            elif ext in ["mp4", "mov", "avi", "mkv"]:
                extracted_text = cls.process_video(file_path, original_filename)
            else:
                raise ValueError(f"Unsupported file format: .{ext}")

            if not extracted_text.strip():
                raise ValueError("File ke andar koi content extract nahi ho paya!")

            doc_id = str(uuid.uuid4())
            metadata = {
                "source": original_filename,
                "type": ext
            }

            vector_store.add_document(
                doc_id=doc_id,
                text=extracted_text,
                metadata=metadata
            )

            return {
                "doc_id": doc_id,
                "filename": original_filename,
                "file_type": ext,
                "status": "success",
                "message": "Hybrid multi-modal file successfully ingested, processed, and stored in vector database!"
            }