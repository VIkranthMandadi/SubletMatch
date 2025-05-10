"use client";

import { useState, useEffect, use, useRef } from "react"; // Added useRef
import Link from "next/link";
import {
  Bath,
  Bed,
  Building,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImagePlus, // Added
  Loader2, // Added for loading states
  MapPin,
  MessageSquare,
  Save, // Added for Save button
  Share2,
  User,
  X, // Added for remove button
} from "lucide-react";
import NextImage from "next/image"; // Renamed to avoid conflict
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/services/auth";
import { useRouter } from "next/navigation";
import { Map } from "@/components/map";
import { userService } from "@/app/services/user";
import { messagesService } from "@/lib/services/messages";

// Define how an image from the backend looks
interface BackendImage {
  id?: string; // IMPORTANT: Best if your backend provides a unique ID for each image
  image_url: string;
}

interface Listing {
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
  images: BackendImage[]; // Use BackendImage type
  user: {
    id: string; // Assuming user has an ID for messaging
    name: string;
    email: string;
  };
  amenities?: string;
}

// This will be the structure for images managed in the UI
interface DisplayImage {
  key: string; // Unique key for React (can be backend ID or a generated one for new images)
  url: string; // URL for display (backend URL or blob URL for new images)
  file?: File; // The actual File object for new images
  id?: string; // The ID from the backend, if it's an existing image
  isNew: boolean; // Flag to identify newly added images
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const MAX_IMAGES_ALLOWED = 10; // Define a limit

interface PageParams {
  id: string;
}

export default function ListingPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  console.log("--- Component RENDER ---");
  const { toast } = useToast();
  const router = useRouter();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial listing fetch
  const [error, setError] = useState("");
  const [listingId, setListingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const fromFind = searchParams.get("from") === "find";
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // State for managing images in the UI
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  // State to track original backend image IDs that are marked for deletion
  const [imageIdsToDelete, setImageIdsToDelete] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false); // For "Save Changes" button loader

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

  const resolvedParams = use(params);
  const id = resolvedParams.id;

  useEffect(() => {
    console.log("useEffect for ID change: received id=", id);
    if (id) {
      setListingId(id);
    }
  }, [id]);

  const fetchListing = async (currentListingId: string | null = listingId) => {
    if (!currentListingId) {
      console.log("fetchListing: No listingId, returning.");
      return;
    }
    console.log(`fetchListing: Fetching listing for ID: ${currentListingId}`);
    setIsLoading(true); // Show main page loader
    setError("");
    try {
      const response = await fetch(`${API_URL}/listings/${currentListingId}`, {
        headers: { Authorization: `Bearer ${authService.getToken()}` },
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("fetchListing: Failed response:", response.status, errorData);
        throw new Error(`Failed to fetch listing (${response.status})`);
      }
      const data: Listing = await response.json();
      console.log("fetchListing: Successfully fetched listing data:", data);
      setListing(data);

      // Initialize displayImages from fetched listing
      const initialDisplayImages: DisplayImage[] = data.images.map((img, index) => ({
        key: img.id || `backend-${img.image_url}-${index}`, // Use backend ID if available, else generate a key
        url: img.image_url,
        id: img.id,
        isNew: false,
      }));
      console.log("fetchListing: Initialized displayImages:", initialDisplayImages);
      setDisplayImages(initialDisplayImages);
      setCurrentImageIndex(0); // Reset to first image
      setImageIdsToDelete([]); // Clear any pending deletions from previous state

    } catch (err) {
      console.error("fetchListing: Error fetching listing:", err);
      setError((err as Error).message || "Failed to load listing data.");
      setDisplayImages([]); // Clear images on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("useEffect for listingId or auth change: listingId=", listingId);
    if (authService.isAuthenticated()) {
      if (listingId) {
        fetchListing(listingId);
      }
    } else {
      console.log("User not authenticated, redirecting to signin.");
      router.push("/signin");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]); // Removed `router` as it's stable and shouldn't trigger re-fetch unless listingId changes

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  const handlePrevImage = () => {
    if (displayImages.length === 0) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? displayImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    if (displayImages.length === 0) return;
    setCurrentImageIndex((prev) =>
      prev === displayImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleImageFileChange: Files selected.");
    if (!e.target.files) {
      console.log("handleImageFileChange: No files selected in event.");
      return;
    }
    const files = Array.from(e.target.files);
    console.log(`handleImageFileChange: ${files.length} file(s) selected.`);

    if (displayImages.length + files.length > MAX_IMAGES_ALLOWED) {
        toast({
            title: "Max Images Reached",
            description: `You can only have up to ${MAX_IMAGES_ALLOWED} images.`,
            variant: "destructive"
        });
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
        return;
    }


    const newImagesToAdd: DisplayImage[] = [];
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      const newImage: DisplayImage = {
        key: `new-${file.name}-${Date.now()}`, // Unique key for this new image
        url: previewUrl,
        file: file,
        isNew: true,
      };
      newImagesToAdd.push(newImage);
      console.log(`handleImageFileChange: Prepared new image:`, newImage, "File Object:", file);
    }

    setDisplayImages((prev) => {
        const updated = [...prev, ...newImagesToAdd];
        console.log("handleImageFileChange: Updated displayImages state:", updated);
        return updated;
    });

    if (fileInputRef.current) { // Reset file input to allow selecting the same file again
        fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    console.log(`handleRemoveImage: Attempting to remove image at index ${indexToRemove}`);
    const imageToRemove = displayImages[indexToRemove];

    if (!imageToRemove) {
      console.warn(`handleRemoveImage: No image found at index ${indexToRemove}`);
      return;
    }
    console.log("handleRemoveImage: Image to remove:", imageToRemove);

    // If it's a new image (has a file object and isNew flag), revoke its blob URL
    if (imageToRemove.isNew && imageToRemove.url.startsWith("blob:")) {
      console.log(`handleRemoveImage: Revoking blob URL: ${imageToRemove.url}`);
      URL.revokeObjectURL(imageToRemove.url);
    }

    // If it's an existing image from the backend (has an `id` and is not new)
    // Add its `id` to the deletion queue if it's not already there
    if (!imageToRemove.isNew && imageToRemove.id && !imageIdsToDelete.includes(imageToRemove.id)) {
      console.log(`handleRemoveImage: Marking backend image ID ${imageToRemove.id} for deletion.`);
      setImageIdsToDelete((prev) => [...prev, imageToRemove.id!]);
    }

    // Remove from UI display
    setDisplayImages((prev) => {
        const updated = prev.filter((_, i) => i !== indexToRemove);
        console.log("handleRemoveImage: Updated displayImages state after removal:", updated);
        return updated;
    });

    // Adjust currentImageIndex
    if (currentImageIndex >= displayImages.length -1 && currentImageIndex > 0) { // if it was the last, go to previous
        setCurrentImageIndex(currentImageIndex -1);
    } else if (displayImages.length -1 === 0) { // if only one was left and removed
        setCurrentImageIndex(0);
    }
    // If removed from before current, index automatically shifts, no change needed.
    // If current was removed and it wasn't last, it points to the "next" element.
  };


  const handleSaveChanges = async () => {
    if (!listingId) {
      console.error("handleSaveChanges: listingId is null. Cannot save.");
      toast({ title: "Error", description: "Listing ID is missing.", variant: "destructive" });
      return;
    }
    console.log("--- handleSaveChanges: Initiating save ---");
    setIsSaving(true);
    const token = authService.getToken();
    if (!token) {
      toast({ title: "Authentication Error", description: "Please sign in to save changes.", variant: "destructive" });
      setIsSaving(false);
      router.push("/signin");
      return;
    }

    let anyErrors = false;

    // 1. Delete images marked for deletion
    if (imageIdsToDelete.length > 0) {
      console.log("handleSaveChanges: Deleting images with IDs:", imageIdsToDelete);
      for (const imageId of imageIdsToDelete) {
        try {
          const response = await fetch(`${API_URL}/listings/${listingId}/images/${imageId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`handleSaveChanges: Failed to delete image ${imageId}. Status: ${response.status}. Response: ${errorText}`);
            toast({ title: "Deletion Error", description: `Could not delete image (ID: ...${imageId.slice(-6)}). ${response.statusText}`, variant: "destructive" });
            anyErrors = true;
          } else {
            console.log(`handleSaveChanges: Successfully deleted image ${imageId}`);
          }
        } catch (err) {
          console.error(`handleSaveChanges: Network or other error deleting image ${imageId}:`, err);
          toast({ title: "Deletion Error", description: `Error deleting image (ID: ...${imageId.slice(-6)}).`, variant: "destructive" });
          anyErrors = true;
        }
      }
    } else {
        console.log("handleSaveChanges: No images marked for deletion.");
    }

    // 2. Upload new images
    const newImagesToUpload = displayImages.filter(img => img.isNew && img.file);
    if (newImagesToUpload.length > 0) {
      console.log("handleSaveChanges: Uploading new images:", newImagesToUpload.map(img => img.file?.name));
      const formData = new FormData();
      newImagesToUpload.forEach(img => {
        if (img.file) {
          formData.append('images', img.file, img.file.name); // Add filename
        }
      });
      
      console.log("handleSaveChanges: FormData content (keys):", Array.from(formData.keys()));
      // To see full FormData, you'd need to iterate:
      // for (var pair of formData.entries()) { console.log(pair[0]+ ', ' + pair[1]); }


      try {
        const response = await fetch(`${API_URL}/listings/${listingId}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }, // Content-Type is set automatically by browser for FormData
          body: formData,
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`handleSaveChanges: Failed to upload new images. Status: ${response.status}. Response: ${errorText}`);
          toast({ title: "Upload Error", description: `Could not upload new images. ${response.statusText}`, variant: "destructive" });
          anyErrors = true;
        } else {
          const uploadResult = await response.json();
          console.log("handleSaveChanges: Successfully uploaded new images. Response:", uploadResult);
        }
      } catch (err) {
        console.error("handleSaveChanges: Network or other error uploading new images:", err);
        toast({ title: "Upload Error", description: "Error uploading new images.", variant: "destructive" });
        anyErrors = true;
      }
    } else {
        console.log("handleSaveChanges: No new images to upload.");
    }

    setIsSaving(false);
    console.log("--- handleSaveChanges: Save process complete ---");

    if (!anyErrors) {
        toast({ title: "Success!", description: "Changes saved." });
    } else {
        toast({ title: "Completed with Errors", description: "Some operations failed. Check console for details.", variant: "default"});
    }
    
    // Always re-fetch the listing to get the latest state from the server
    console.log("handleSaveChanges: Re-fetching listing to reflect changes.");
    fetchListing(listingId);
  };

  // handleSendMessage (your existing logic)
  const handleSendMessage = async () => { /* ... copy from your original ... */ };

  if (isLoading && !listing) { // Show full page loader only if listing is not yet available
    return (
      <div className="container py-8 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center text-red-500 p-4 border border-red-500 rounded-md">
          <p className="font-semibold">Error Loading Listing</p>
          <p>{error}</p>
          <Button onClick={() => fetchListing(listingId)} className="mt-4">Try Again</Button>
        </div>
      </div>
    );
  }
  
  if (!listing) { // Should be covered by isLoading, but as a fallback
     return (
      <div className="container py-8 text-center">Listing data is not available.</div>
     );
  }


  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <span /* Logo/Brand */> {/* ... */} </span>
          <div className="flex items-center gap-4">
            <Button
                onClick={handleSaveChanges}
                disabled={isSaving || (imageIdsToDelete.length === 0 && !displayImages.some(img => img.isNew))}
            >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Image Changes
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8">
          <div className="flex items-center mb-6"> {/* Back Button */} {/* ... */} </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {/* --- Image Display Section --- */}
              <div className="mb-6">
                {/* Main Image */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl mb-4 border">
                  {displayImages.length > 0 && displayImages[currentImageIndex] ? (
                    <NextImage
                      src={displayImages[currentImageIndex].url}
                      alt={`Image ${currentImageIndex + 1} of ${listing.title}`}
                      fill
                      className="object-contain object-center" // Use contain to see whole image
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={currentImageIndex === 0}
                      onError={(e) => { console.error("Error loading main image:", displayImages[currentImageIndex].url); (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex flex-col items-center justify-center rounded-lg">
                      <Building className="h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">No images available</p>
                    </div>
                  )}
                  {displayImages.length > 1 && (
                    <> {/* Carousel Buttons */}
                      <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 rounded-full" onClick={handlePrevImage}><ChevronLeft className="h-5 w-5" /></Button>
                      <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 rounded-full" onClick={handleNextImage}><ChevronRight className="h-5 w-5" /></Button>
                    </>
                  )}
                </div>

                {/* Thumbnails & Add Image */}
                <div className="flex flex-wrap gap-3 items-start">
                  {displayImages.map((img, index) => (
                    <div
                      key={img.key}
                      className={`relative aspect-square w-24 h-24 cursor-pointer rounded-lg overflow-hidden group border-2 ${
                        index === currentImageIndex ? "border-primary ring-2 ring-primary ring-offset-1" : "border-muted-foreground/30"
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <NextImage
                        src={img.url}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="96px" // approx w-24
                        onError={(e) => { console.error("Error loading thumbnail:", img.url); (e.target as HTMLImageElement).src = "/placeholder.svg";}}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 z-10 h-6 w-6 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                        disabled={isSaving}
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {displayImages.length < MAX_IMAGES_ALLOWED && (
                    <label
                      htmlFor="add-image-input"
                      className={`aspect-square w-24 h-24 border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${
                        isSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/20'
                      }`}
                    >
                      <ImagePlus className="h-7 w-7 mb-1" />
                      <span className="text-xs">Add Photo</span>
                      <input
                        id="add-image-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg, image/png, image/gif, image/webp" // Common types, HEIC excluded for now
                        multiple
                        onChange={handleImageFileChange}
                        className="hidden"
                        disabled={isSaving}
                      />
                    </label>
                  )}
                </div>
              </div>
              {/* --- End Image Display Section --- */}


              {/* Other Listing Details */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <Button variant="outline" size="sm"><Heart className="mr-1 h-4 w-4" />Save</Button>
                  <Button variant="outline" size="sm"><Share2 className="mr-1 h-4 w-4" />Share</Button>
                </div>
              </div>
              {/* ... Rest of your listing details (address, price, beds, baths, tabs etc.) */}
              {/* Make sure to copy these sections from your original code */}
               <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {listing.address}, {listing.city}, {listing.state}
                </span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                <span>
                  Available:{" "}
                  {new Date(listing.available_from).toLocaleDateString()} -{" "}
                  {new Date(listing.available_to).toLocaleDateString()}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-1">
                  <Bed className="h-5 w-5 text-muted-foreground" />
                  <span>
                    {listing.bedrooms} Bedroom
                    {listing.bedrooms !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Bath className="h-5 w-5 text-muted-foreground" />
                  <span>
                    {listing.bathrooms} Bathroom
                    {listing.bathrooms !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="font-medium text-lg">
                  ${listing.price}/month
                </div>
              </div>

              <Tabs defaultValue="description" className="mb-8">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="description">Description</TabsTrigger>
                  <TabsTrigger value="amenities">Amenities</TabsTrigger>
                  <TabsTrigger value="location">Location</TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-4">
                  <p className="text-muted-foreground">{listing.description}</p>
                </TabsContent>
                <TabsContent value="amenities" className="mt-4">
                   {/* Check if amenities string exists and is not empty before splitting */}
                  {listing.amenities && listing.amenities.trim() !== "" ? (
                    <div className="flex flex-wrap gap-2">
                      {listing.amenities.split(" ").map((amenity, index) => (
                        <div
                          key={index}
                          className="px-3 py-1 bg-muted rounded-full text-sm"
                        >
                          {amenity}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No amenities listed.</p>
                  )}
                </TabsContent>
                <TabsContent value="location" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {listing.address}, {listing.city}, {listing.state}
                      </span>
                    </div>
                    <Map
                      address={`${listing.address}, ${listing.city}, ${listing.state}`}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="lg:col-span-1"> {/* Contact Host Card */} {/* ... */} </div>
          </div>
        </div>
      </main>
      <footer className="border-t py-6 md:py-0"> {/* ... */} </footer>
    </div>
  );
}