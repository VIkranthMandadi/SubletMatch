"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services/auth";
import { listingService } from "@/lib/services/listing";
import { ListingForm } from "@/components/listing-form";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

// Import image processing libraries
import imageCompression from 'browser-image-compression';
let heic2any: any = null;
if (typeof window !== 'undefined') {
  import('heic2any').then(module => {
    heic2any = module.default;
  }).catch(err => console.error("Failed to load heic2any:", err));
}

interface ListingImage {
  id: string;
  image_url: string;
}

interface EditListingFormProps {
  listing: {
    id: string;
    title: string;
    description: string;
    price: number;
    address: string;
    city: string;
    state: string;
    property_type: string;
    bedrooms: number;
    bathrooms: number;
    available_from: string;
    available_to: string;
    amenities: string;
    images: ListingImage[];
  };
}

const MAX_IMAGES_TOTAL = 10;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;


export function EditListingForm({ listing }: EditListingFormProps) {
  const router = useRouter();
  const [existingImages, setExistingImages] = useState<ListingImage[]>(listing.images || []);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviewUrls, setNewImagePreviewUrls] = useState<string[]>([]);
  const [imageIdsToDelete, setImageIdsToDelete] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false); // Single flag for overall processing
  const { toast } = useToast();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push("/signin");
    }
  }, [router]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {

    if (!e.target.files || e.target.files.length === 0) {
      console.log("handleImageChange: No files selected in event.");
      return;
    }

    const selectedFiles = Array.from(e.target.files);
    if (e.target) e.target.value = ""; // Reset input immediately after files are grabbed

    console.log("handleImageChange: Files selected:", selectedFiles.map(f => f.name));

    if (existingImages.length + newImageFiles.length + selectedFiles.length > MAX_IMAGES_TOTAL) {
      toast({ title: "Max Images Reached", description: `Max ${MAX_IMAGES_TOTAL} images.`, variant: "destructive"});
      return;
    }
    
    if (!heic2any) { // Check if the heic2any library is loaded
        toast({ title: "Image Processing Error", description: "Image processing library (heic2any) not yet loaded. Please try again in a moment.", variant: "destructive"});
        return;
    }

    setIsProcessingImages(true); // Set global processing flag

    const processedFilesToAdd: File[] = [];
    const processedPreviewsToAdd: string[] = [];

    for (const file of selectedFiles) {
      console.log(`Processing: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

      // 1. Size Check
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ title: "Image Processing Error", description: `${file.name} is too large (max ${MAX_IMAGE_SIZE_MB}MB) and was skipped.`, variant: "destructive"});
        console.warn(`${file.name} skipped due to size.`); // Keep console warn for dev
        continue; // Skip this file and go to the next one
      }

      try {
        let workingFile = file;

        // 2. HEIC Conversion
        if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
          console.log(`Attempting HEIC conversion for: ${file.name}`);
          // Ensure heic2any is loaded (it should be due to the check above, but good practice)
          if (typeof heic2any !== 'function') { 
            throw new Error("HEIC conversion tool is not available.");
          }
          const heicBlob = new Blob([file], { type: file.type });
          const convertedBlob = await heic2any({
            blob: heicBlob,
            toType: "image/jpeg",
            quality: 0.9, // Adjust quality as needed
          });
          
          // heic2any can return a single Blob or an array of Blobs (for multi-image HEICs)
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          if (!finalBlob) {
            throw new Error("HEIC conversion resulted in no valid image data.");
          }

          workingFile = new File([finalBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
          console.log(`HEIC converted: ${workingFile.name}, new size: ${workingFile.size} bytes`);
        }

        // 3. Image Compression (Applied to original or HEIC-converted file)
        console.log(`Attempting compression for: ${workingFile.name}`);
        const compressedFile = await imageCompression(workingFile, {
          maxSizeMB: 2, // Further compress if still large, e.g. after HEIC conversion
          maxWidthOrHeight: 1920, // Standard HD resolution
          useWebWorker: true,
          initialQuality: 0.75, // Start with a decent quality for compression
        });
        console.log(`Compressed: ${compressedFile.name}, final size: ${Math.round(compressedFile.size / 1024)}KB`);
        
        processedFilesToAdd.push(compressedFile);
        processedPreviewsToAdd.push(URL.createObjectURL(compressedFile));

      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
        toast({ title: "Image Processing Error", description: `Could not process ${file.name}. It was skipped. ${(err as Error).message}`, variant: "destructive"});
      }
    } // End of for...of loop

    if (processedFilesToAdd.length > 0) {
      setNewImageFiles((prev) => [...prev, ...processedFilesToAdd]);
      setNewImagePreviewUrls((prev) => [...prev, ...processedPreviewsToAdd]);
      console.log(`Added ${processedFilesToAdd.length} processed images to state.`);
    } else {
      console.log("No new images were successfully processed and added.");
    }

    setIsProcessingImages(false); // Clear global processing flag
    console.log("handleImageChange: Finished processing all selected files.");
  };

  const removeImage = (index: number, isExistingImage: boolean) => {
    console.log(`removeImage: index=${index}, isExistingImage=${isExistingImage}`);
    if (isExistingImage) {
      const imageToRemove = existingImages[index];
      if (imageToRemove) {
        console.log(`Marking existing image for deletion: ID=${imageToRemove.id}`);
        setImageIdsToDelete(prev => [...prev, imageToRemove.id]);
        setExistingImages((prev) => prev.filter((_, i) => i !== index));
      }
    } else {
      console.log(`Removing new image at preview index ${index}`);
      const urlToRevoke = newImagePreviewUrls[index];
      if (urlToRevoke && urlToRevoke.startsWith("blob:")) {
        URL.revokeObjectURL(urlToRevoke);
      }
      setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
      setNewImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmitFormViaButton = () => {
    const form = document.getElementById("inner-listing-form");
    if (form && typeof (form as HTMLFormElement).requestSubmit === 'function') {
      (form as HTMLFormElement).requestSubmit();
    } else if (form) { // Fallback
      const submitButton = document.createElement('button');
      submitButton.type = 'submit'; submitButton.style.display = 'none';
      form.appendChild(submitButton); submitButton.click(); form.removeChild(submitButton);
    } else {
      console.error("Inner ListingForm (id='inner-listing-form') not found.");
      toast({ title: "Form Submission Error", description: "Could not submit form data.", variant: "destructive"});
    }
  };

  const handleListingFormSubmit = async (textFormData: Record<string, string | number>) => {

    setIsLoading(true);
    let anyError = false;
    console.log("--- Initiating Save Process ---");
    // ... (rest of your handleSubmit logic for API calls - this part remains the same) ...
    try {
      // Step 1: Update textual listing data
      console.log("Step 1: Updating textual listing data...");
      const updatePayload = new FormData();
      Object.entries(textFormData).forEach(([key, value]) => {
        updatePayload.append(key, String(value));
      });
      await listingService.updateListing(listing.id, updatePayload);
      console.log("Textual data update successful.");

      // Step 2: Delete images marked for deletion
      if (imageIdsToDelete.length > 0) {
        console.log("Step 2: Deleting images...", imageIdsToDelete);
        for (const imageId of imageIdsToDelete) {
          try {
            await listingService.deleteListingImage(listing.id, imageId);
            console.log(`Deleted image ${imageId}`);
          } catch (deleteError) {
            console.error(`Failed to delete image ${imageId}:`, deleteError);
            toast({ title: "Image Deletion Error", description: `Failed to delete image (ID: ...${imageId.slice(-6)})`, variant: "destructive"});
            anyError = true;
          }
        }
      }

      // Step 3: Upload new images
      if (newImageFiles.length > 0) {
        console.log("Step 3: Uploading new images...", newImageFiles.map(f => f.name));
        const imageUploadFormData = new FormData();
        newImageFiles.forEach((file) => {
          imageUploadFormData.append("images", file);
        });
        await listingService.uploadListingImages(listing.id, imageUploadFormData);
        console.log("New images uploaded successfully.");
      }

      if (!anyError) {
        toast({ title: "Listing Update Success", description: "Listing updated successfully!", variant: "default"});
        // Clear local states for new/deleted images as they are now persisted
        setNewImageFiles([]);
        newImagePreviewUrls.forEach(URL.revokeObjectURL); // Clean up all blob URLs
        setNewImagePreviewUrls([]);
        setImageIdsToDelete([]);
        // Redirect or refresh to show the latest data from server
        // It's often better to fetch the updated listing or rely on router.refresh()
        // than trying to manually merge new image data from upload response.
        router.push("/dashboard"); // Or to the specific listing page
        router.refresh(); 
      } else {
        toast({ title: "Listing Update Warning", description: "Listing updated, but some image operations failed. Please review.", variant: "default"});
        // Fetch fresh data to reflect what actually succeeded/failed
        // This could be done by redirecting to a page that re-fetches, or calling a fetch function here
        router.refresh(); // Attempt to refresh current data from server
      }

    } catch (error) {
      console.error("Error during listing update process:", error);
      toast({ title: "Listing Update Error", description: `Failed to update listing: ${(error as Error).message || "Unknown error"}`, variant: "destructive"});
      anyError = true;
    } finally {
      setIsLoading(false);
      console.log("--- Save Process Finished ---");
    }
  };  

  return (
    <div className="space-y-8">
      <ListingForm
        listing={listing}
        onSubmit={handleListingFormSubmit}
        showButtons={false}
        formId="inner-listing-form"
      />

      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Listing Images</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add or remove images (max {MAX_IMAGES_TOTAL} total, {MAX_IMAGE_SIZE_MB}MB per image).
            </p>
          </div>
          <label className={`relative inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors ${isLoading || isProcessingImages || (existingImages.length + newImageFiles.length >= MAX_IMAGES_TOTAL) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            {isProcessingImages ? <Loader2 className="h-4 w-4 animate-spin"/> : <ImagePlus className="h-4 w-4" />}
            <span>{isProcessingImages ? "Processing..." : "Add Images"}</span>
            <input
              type="file"
              accept="image/*,.heic,.heif" // Allow HEIC/HEIF
              multiple
              className="hidden"
              onChange={handleImageChange}
              disabled={isLoading || isProcessingImages || (existingImages.length + newImageFiles.length >= MAX_IMAGES_TOTAL)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Display existing images */}
          {existingImages.map((image, index) => (
            <div key={`existing-${image.id}`} className="relative aspect-square group rounded-lg overflow-hidden border">
              <Image src={image.image_url} alt={`Existing image ${index + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button type="button" onClick={() => removeImage(index, true)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors" disabled={isLoading || isProcessingImages} aria-label="Delete existing image">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}

          {/* Display previews of new images */}
          {newImagePreviewUrls.map((url, index) => (
            <div key={`new-preview-${index}-${url}`} className="relative aspect-square group rounded-lg overflow-hidden border">
              <Image src={url} alt={`New image preview ${index + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button type="button" onClick={() => removeImage(index, false)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors" disabled={isLoading || isProcessingImages} aria-label="Remove new image">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}

          {(existingImages.length === 0 && newImagePreviewUrls.length === 0) && (
             <div className="col-span-full aspect-[2/1] border-2 border-dashed rounded-lg flex items-center justify-center">
              <div className="text-center">
                <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No images added yet. Click "Add Images".
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard")} disabled={isLoading || isProcessingImages}>Cancel</Button>
        <Button
          type="button"
          disabled={isLoading || isProcessingImages || (imageIdsToDelete.length === 0 && newImageFiles.length === 0)}
          onClick={handleSubmitFormViaButton}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}