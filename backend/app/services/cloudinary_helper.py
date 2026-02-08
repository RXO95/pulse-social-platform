"""
Cloudinary Upload Helper

Handles file uploads to Cloudinary and returns the URL.
Supports images and videos.
"""

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
import os
from typing import Optional, Tuple
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Cloudinary from environment variables
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


async def upload_to_cloudinary(
    file: UploadFile,
    folder: str = "pulse",
    resource_type: str = "auto"
) -> Tuple[str, str]:
    """
    Upload a file to Cloudinary and return the URL and media type.
    
    Args:
        file: The uploaded file from FastAPI
        folder: Cloudinary folder to organize files
        resource_type: "auto", "image", or "video"
    
    Returns:
        Tuple of (url, media_type) where media_type is "image" or "video"
    
    Raises:
        HTTPException: If upload fails or file type is not supported
    """
    # Validate file type
    allowed_image_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    allowed_video_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
    allowed_types = allowed_image_types + allowed_video_types
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: images (jpeg, png, gif, webp) and videos (mp4, webm, mov, avi)"
        )
    
    # Determine media type
    if file.content_type in allowed_image_types:
        media_type = "image"
    else:
        media_type = "video"
    
    try:
        # Read file contents
        contents = await file.read()
        
        # Upload to Cloudinary
        # Using upload_large for potential video support
        result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            resource_type=resource_type,
            transformation={
                "quality": "auto",
                "fetch_format": "auto"
            } if media_type == "image" else None
        )
        
        # Return the secure URL and media type
        return result["secure_url"], media_type
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file to Cloudinary: {str(e)}"
        )


async def upload_profile_picture(file: UploadFile) -> str:
    """
    Upload a profile picture to Cloudinary.
    Only allows image files with specific transformations for avatars.
    
    Returns:
        The secure URL of the uploaded avatar
    """
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Profile picture must be an image (jpeg, png, gif, webp)"
        )
    
    try:
        contents = await file.read()
        
        # Upload with avatar-specific transformations
        result = cloudinary.uploader.upload(
            contents,
            folder="pulse/avatars",
            resource_type="image",
            transformation=[
                {"width": 400, "height": 400, "crop": "fill", "gravity": "face"},
                {"quality": "auto", "fetch_format": "auto"}
            ]
        )
        
        return result["secure_url"]
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload profile picture: {str(e)}"
        )


async def delete_from_cloudinary(public_id: str, resource_type: str = "image") -> bool:
    """
    Delete a file from Cloudinary by its public_id.
    
    Returns:
        True if deletion was successful
    """
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return result.get("result") == "ok"
    except Exception:
        return False
