"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import {
  Bath,
  Bed,
  Building,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImagePlus,
  Loader2,
  MapPin,
  MessageSquare,
  Save,
  Share2,
  User,
  X,
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
import { userService } from "@/app/services/user"; // Ensure this is correctly imported
import { messagesService } from "@/lib/services/messages"; // Ensure this is correctly imported

// Matches your backend ListingImageSchema (partially)
interface BackendImage {
  id: string; // This IS available from your backend
  image_url: string;
  listing_id?: string; // Optional, from backend response
  created_at?: string; // Optional, from backend response
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
  images: BackendImage[];
  user: {
    id: string;
    name: string;
    email: string;
  };
  amenities?: string;
}

interface DisplayImage {
  key: string; // Unique key for React (backend ID or a temp generated one)
  url: string; // URL for display (backend URL or blob URL for new images)
  file?: File; // The actual File object for new images
  id?: string; // The ID from the backend, if it's an existing image
  isNew: boolean; // Flag to identify newly added images
  // tempUploadId?: string; // Optional: A temporary ID to match upload response to UI element
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const MAX_IMAGES_ALLOWED = 10;

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [listingId, setListingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const fromFind = searchParams.get("from") === "find";
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [imageIdsToDelete, setImageIdsToDelete] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedParams = use(params);
  const routeParamId = resolvedParams.id; // Renamed to avoid confusion with listing.id

  useEffect(() => {
    console.log("useEffect for routeParamId change: received id=", routeParamId);
    if (routeParamId) {
      setListingId(routeParamId);
    }
  }, [routeParamId]);

  const fetchListing = async (currentListingIdToFetch: string | null = listingId) => {
    if (!currentListingIdToFetch) {
      console.log("fetchListing: No listingId, returning.");
      return;
    }
    console.log(`fetchListing: Fetching listing for ID: ${currentListingIdToFetch}`);
    setIsLoading(true);
    setError("");
    try {
      const token = authService.getToken();
      if (!token) {
          console.error("fetchListing: No auth token found. Redirecting.");
          router.push("/signin");
          setIsLoading(false); // Important to stop loading
          return;
      }
      const response = await fetch(`${API_URL}/listings/${currentListingIdToFetch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("fetchListing: Failed response:", response.status, errorData);
        throw new Error(`Failed to fetch listing (${response.status}). Server: ${errorData.substring(0,100)}`);
      }
      const data: Listing = await response.json();
      console.log("fetchListing: Successfully fetched listing data:", data);
      setListing(data);

      const initialDisplayImages: DisplayImage[] = data.images.map((img) => ({
        key: img.id, // Use backend ID as key directly
        url: img.image_url,
        id: img.id,
        isNew: false,
      }));
      console.log("fetchListing: Initialized displayImages:", initialDisplayImages);
      setDisplayImages(initialDisplayImages);
      setCurrentImageIndex(initialDisplayImages.length > 0 ? 0 : -1); // -1 if no images
      setImageIdsToDelete([]);

    } catch (err) {
      console.error("fetchListing: Error fetching listing:", err);
      setError((err as Error).message || "Failed to load listing data.");
      setDisplayImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("useEffect for auth or listingId change: listingId=", listingId);
    const authenticated = authService.isAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      if (listingId) {
        fetchListing(listingId);
      }
    } else {
      console.log("User not authenticated, redirecting to signin.");
      router.push("/signin");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]); // Only depend on listingId for fetching. Auth check is internal.


  const handlePrevImage = () => {
    if (displayImages.length === 0) return;
    setCurrentImageIndex((prev) =>
      prev <= 0 ? displayImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    if (displayImages.length === 0) return;
    setCurrentImageIndex((prev) =>
      prev >= displayImages.length - 1 ? 0 : prev + 1
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
        toast({ title: "Max Images Reached", description: `Max ${MAX_IMAGES_ALLOWED} images.`, variant: "destructive"});
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    const newImagesToAdd: DisplayImage[] = [];
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      // Use a more robust temporary key, e.g., based on filename and timestamp
      const tempKey = `new-${file.name}-${Date.now()}`;
      const newImage: DisplayImage = {
        key: tempKey, // This key is temporary for UI purposes
        url: previewUrl,
        file: file,
        isNew: true,
      };
      newImagesToAdd.push(newImage);
      console.log(`handleImageFileChange: Prepared new image (temp key: ${tempKey}):`, file.name);
    }

    setDisplayImages((prev) => {
        const updated = [...prev, ...newImagesToAdd];
        console.log("handleImageFileChange: Updated displayImages state:", updated.map(im => ({key: im.key, url: im.url.substring(0,30), isNew: im.isNew})));
        return updated;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (indexToRemove: number) => {
    console.log(`handleRemoveImage: Attempting to remove image at index ${indexToRemove}`);
    const imageToRemove = displayImages[indexToRemove];

    if (!imageToRemove) {
      console.warn(`handleRemoveImage: No image found at index ${indexToRemove}`);
      return;
    }
    console.log("handleRemoveImage: Image to remove:", {key: imageToRemove.key, id: imageToRemove.id, isNew: imageToRemove.isNew});

    if (imageToRemove.isNew && imageToRemove.url.startsWith("blob:")) {
      console.log(`handleRemoveImage: Revoking blob URL: ${imageToRemove.url}`);
      URL.revokeObjectURL(imageToRemove.url);
    }

    if (!imageToRemove.isNew && imageToRemove.id) { // It's an existing backend image
      if (!imageIdsToDelete.includes(imageToRemove.id)) {
        console.log(`handleRemoveImage: Marking backend image ID ${imageToRemove.id} for deletion.`);
        setImageIdsToDelete((prev) => [...prev, imageToRemove.id!]);
      } else {
        console.log(`handleRemoveImage: Backend image ID ${imageToRemove.id} already marked for deletion.`);
      }
    }

    setDisplayImages((prev) => {
        const updated = prev.filter((_, i) => i !== indexToRemove);
        console.log("handleRemoveImage: Updated displayImages state after removal:", updated.map(im => ({key: im.key, id: im.id, isNew: im.isNew})));
        return updated;
    });

    // Adjust currentImageIndex after removal
    const newLength = displayImages.length - 1;
    if (newLength <= 0) {
      setCurrentImageIndex(-1); // No images left
    } else if (currentImageIndex >= newLength) {
      setCurrentImageIndex(newLength - 1); // If last was removed, point to new last
    } else if (indexToRemove < currentImageIndex) {
      // If an image before the current one was removed, shift current index back
      // This is implicitly handled if currentImageIndex is not changed, as the array shrinks
      // But to be safe, if currentImageIndex was > 0 and an earlier image was removed,
      // you might want to decrement. Let's test this behavior.
      // No, if an item before current is removed, current's effective index decreases.
      // So, if the removed item was the current one, and it was not the last one,
      // the next item automatically becomes current. If it was the last, newLength-1 covers it.
    }
     // If no images, set to -1 or an indicator of no selection
    if (displayImages.length -1 === 0 && indexToRemove === 0) setCurrentImageIndex(-1);
    else if (currentImageIndex === indexToRemove) {
        // If current image is removed, try to select the previous one, or 0 if it was the first
        setCurrentImageIndex(Math.max(0, indexToRemove - 1));
    } else if (indexToRemove < currentImageIndex) {
        setCurrentImageIndex(currentImageIndex - 1); // Shift index if an earlier image was removed
    }
  };

  const handleSaveChanges = async () => {
    if (!listingId) {
      console.error("handleSaveChanges: listingId is null.");
      toast({ title: "Error", description: "Listing ID missing.", variant: "destructive" });
      return;
    }
    console.log("--- handleSaveChanges: Initiating save ---");
    console.log("Current imageIdsToDelete:", imageIdsToDelete);
    console.log("Current displayImages (isNew filter):", displayImages.filter(img => img.isNew).map(img => img.file?.name));

    setIsSaving(true);
    const token = authService.getToken();
    if (!token) { /* ... auth error ... */ setIsSaving(false); return; }

    let anyErrors = false;

    // 1. Delete images
    if (imageIdsToDelete.length > 0) {
      console.log("handleSaveChanges: Deleting images:", imageIdsToDelete);
      for (const imageId of imageIdsToDelete) {
        try {
          const response = await fetch(`${API_URL}/listings/${listingId}/images/${imageId}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) { /* ... error handling ... */ anyErrors = true; console.error(`Failed to delete ${imageId}`);}
          else { console.log(`Successfully deleted image ${imageId}`); }
        } catch (err) { /* ... error handling ... */ anyErrors = true; console.error(`Error deleting ${imageId}`, err); }
      }
    }

    // 2. Upload new images
    const newImagesToUpload = displayImages.filter(img => img.isNew && img.file);
    if (newImagesToUpload.length > 0) {
      console.log("handleSaveChanges: Uploading new images:", newImagesToUpload.map(img => ({key: img.key, name: img.file?.name})));
      const formData = new FormData();
      newImagesToUpload.forEach(img => { if (img.file) formData.append('images', img.file, img.file.name); });

      try {
        const response = await fetch(`${API_URL}/listings/${listingId}/images`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`handleSaveChanges: Upload failed. Status: ${response.status}. Body: ${errorText}`);
          toast({ title: "Upload Error", description: `Could not upload new images. ${response.statusText}`, variant: "destructive" });
          anyErrors = true;
        } else {
          const uploadedImagesData: BackendImage[] = await response.json();
          console.log("handleSaveChanges: Successfully uploaded new images. Response:", uploadedImagesData);
          
          // CRITICAL STEP: Update displayImages with backend data for uploaded images
          setDisplayImages(prevDisplayImages => {
            let updatedImages = [...prevDisplayImages];
            newImagesToUpload.forEach(localNewImage => {
              // Find the corresponding uploaded image from backend response.
              // This assumes the backend returns images in a way that can be matched,
              // or that we trust the order. If names are unique per upload batch, can match by name.
              // For now, let's assume the backend response array `uploadedImagesData` corresponds
              // to the `newImagesToUpload` files sent. This is risky if order isn't guaranteed.
              // A better way is if the backend could return the original tempKey or filename.
              // Simplest for now if backend returns data for *all* images of the listing after upload:
              // We'll rely on the re-fetch for now.
              // OR if the backend returns the newly created image objects:
              const matchedBackendImage = uploadedImagesData.find(
                // This match is tricky. If filename is part of unique_filename on backend it's better.
                // For now, this is a placeholder match logic.
                // Ideally, your POST /images endpoint returns enough info to uniquely identify which local file corresponds to which new backend image record.
                // For example, if your backend uses the original filename in the S3 key, you could try to match based on that.
                // Or, you could send a temporary client-generated ID with each file in FormData, and have backend return it.
                // Let's assume for now that the `fetchListing` after will fix everything.
              );

              // This part is complex without a clear matching strategy.
              // The `fetchListing()` at the end is currently the most reliable way to update.
            });
            return updatedImages; // This might not be fully effective without better matching.
          });
        }
      } catch (err) { /* ... error handling ... */ anyErrors = true; console.error("Error uploading", err); }
    }

    setIsSaving(false);
    console.log("--- handleSaveChanges: Save process complete. anyErrors:", anyErrors, "---");

    if (!anyErrors) {
        toast({ title: "Success!", description: "Image changes processed." });
    } else {
        toast({ title: "Completed with Errors", description: "Some image operations failed. Check console.", variant: "default"});
    }
    
    console.log("handleSaveChanges: Re-fetching listing to reflect all changes.");
    fetchListing(listingId); // This is key to sync with server state.
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !listing) return;
    try {
      const token = authService.getToken();
      if (!token) {
        console.error("No token found in localStorage");
        router.push("/signin");
        return;
      }
      const currentUser = await userService.getCurrentUser(token); // Ensure userService is correctly set up
      if (!currentUser?.id) throw new Error("Could not get current user information");

      const result = await messagesService.sendMessage({ // Ensure messagesService is correctly set up
        content: message,
        receiver_id: listing.user.id, // Assuming listing.user.id exists
        listing_id: listing.id,
        sender_id: currentUser.id,
      });
      if (result.success) {
        toast({ title: "Message sent!", description: "Your message has been sent to the host." });
        router.push("/dashboard?tab=messages");
      } else {
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      if (error instanceof Error && error.message.includes("401")) {
        authService.logout(); router.push("/signin"); return;
      }
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to send message.", variant: "destructive" });
    }
  };


  // --- RENDER LOGIC ---
  if (isLoading && !listing) {
    return ( /* ... Loader ... */ <div className="container py-8 flex justify-center items-center min-h-[calc(100vh-200px)]"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div> );
  }
  if (error) {
    return ( /* ... Error display ... */ <div className="container py-8"><div className="text-center text-red-500 p-4 border border-red-500 rounded-md"><p className="font-semibold">Error: {error}</p><Button onClick={() => fetchListing(listingId)} className="mt-4">Try Again</Button></div></div> );
  }
  if (!listing) {
    return ( /* ... No listing data ... */ <div className="container py-8 text-center">Listing not found or not loaded.</div>);
  }
  
  // Determine the current image URL for the main display
  const currentDisplayImageUrl = (currentImageIndex >= 0 && displayImages[currentImageIndex]) 
                                 ? displayImages[currentImageIndex].url 
                                 : "/placeholder.svg";


  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <span
            className="flex items-center gap-2 font-bold text-xl cursor-pointer"
            onClick={() => router.push(isAuthenticated ? "/dashboard" : "/")}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(isAuthenticated ? "/dashboard" : "/");}}
            aria-label="LeaseLink Home"
          >
            <Building className="h-6 w-6 text-primary" />
            <span>LeaseLink</span>
          </span>
          <div className="flex items-center gap-4">
            <Button
                onClick={handleSaveChanges}
                disabled={isSaving || (imageIdsToDelete.length === 0 && !displayImages.some(img => img.isNew))}
            >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Image Changes
            </Button>
            <Link href="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8">
          <div className="flex items-center mb-6">
            <Button variant="link" className="flex items-center text-muted-foreground hover:text-foreground p-0"
              onClick={() => router.push(fromFind ? "/find" : "/dashboard")}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="mb-6">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl mb-4 border">
                  {displayImages.length > 0 && currentImageIndex !== -1 ? (
                    <NextImage
                      src={currentDisplayImageUrl}
                      alt={`Image ${currentImageIndex + 1} of ${listing.title}`}
                      fill className="object-contain object-center"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={currentImageIndex === 0}
                      onError={(e) => { console.error("Error loading main image:", currentDisplayImageUrl); (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex flex-col items-center justify-center rounded-lg">
                      <Building className="h-12 w-12 text-muted-foreground" /><p className="mt-2 text-muted-foreground">No images available</p>
                    </div>
                  )}
                  {displayImages.length > 1 && (
                    <>
                      <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 rounded-full" onClick={handlePrevImage}><ChevronLeft className="h-5 w-5" /></Button>
                      <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 rounded-full" onClick={handleNextImage}><ChevronRight className="h-5 w-5" /></Button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 items-start">
                  {displayImages.map((img, index) => (
                    <div
                      key={img.key} // Crucial for React to correctly update/remove items
                      className={`relative aspect-square w-24 h-24 cursor-pointer rounded-lg overflow-hidden group border-2 ${
                        index === currentImageIndex ? "border-primary ring-2 ring-primary ring-offset-1" : "border-muted-foreground/30"
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <NextImage
                        src={img.url} alt={`Thumbnail ${index + 1}`} fill className="object-cover" sizes="96px"
                        onError={(e) => { console.error("Error loading thumbnail:", img.url); (e.target as HTMLImageElement).src = "/placeholder.svg";}}
                      />
                      <Button
                        variant="destructive" size="icon"
                        className="absolute top-1 right-1 z-10 h-6 w-6 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                        disabled={isSaving} aria-label={`Remove image ${index + 1}`}
                      > <X className="h-4 w-4" /> </Button>
                    </div>
                  ))}
                  {displayImages.length < MAX_IMAGES_ALLOWED && (
                    <label htmlFor="add-image-input"
                      className={`aspect-square w-24 h-24 border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${
                        isSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/20'
                      }`}
                    >
                      <ImagePlus className="h-7 w-7 mb-1" /> <span className="text-xs">Add Photo</span>
                      <input id="add-image-input" ref={fileInputRef} type="file"
                        accept="image/jpeg, image/png, image/gif, image/webp" multiple
                        onChange={handleImageFileChange} className="hidden" disabled={isSaving}
                      />
                    </label>
                  )}
                </div>
              </div>
              {/* --- Rest of your listing details --- */}
              {/* (Make sure to copy this from your original component) */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <Button variant="outline" size="sm"><Heart className="mr-1 h-4 w-4" />Save</Button>
                  <Button variant="outline" size="sm"><Share2 className="mr-1 h-4 w-4" />Share</Button>
                </div>
              </div>
               <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span> {listing.address}, {listing.city}, {listing.state} </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                <span> Available: {new Date(listing.available_from).toLocaleDateString()} - {new Date(listing.available_to).toLocaleDateString()}</span>
              </div>
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-1"> <Bed className="h-5 w-5 text-muted-foreground" /> <span> {listing.bedrooms} Bedroom{listing.bedrooms !== 1 ? "s" : ""} </span> </div>
                <div className="flex items-center gap-1"> <Bath className="h-5 w-5 text-muted-foreground" /> <span> {listing.bathrooms} Bathroom{listing.bathrooms !== 1 ? "s" : ""} </span> </div>
                <div className="font-medium text-lg"> ${listing.price}/month </div>
              </div>
              <Tabs defaultValue="description" className="mb-8">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="description">Description</TabsTrigger>
                  <TabsTrigger value="amenities">Amenities</TabsTrigger>
                  <TabsTrigger value="location">Location</TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-4"> <p className="text-muted-foreground">{listing.description}</p> </TabsContent>
                <TabsContent value="amenities" className="mt-4">
                  {listing.amenities && listing.amenities.trim() !== "" ? (
                    <div className="flex flex-wrap gap-2"> {listing.amenities.split(" ").map((amenity, index) => (<div key={index} className="px-3 py-1 bg-muted rounded-full text-sm">{amenity}</div>))} </div>
                  ) : (<p className="text-muted-foreground">No amenities listed.</p>)}
                </TabsContent>
                <TabsContent value="location" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground"> <MapPin className="h-4 w-4" /> <span> {listing.address}, {listing.city}, {listing.state} </span> </div>
                    <Map address={`${listing.address}, ${listing.city}, ${listing.state}`} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="lg:col-span-1"> {/* Contact Host Card */}
              <Card className="sticky top-24">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
                    <div>
                      <h3 className="font-medium">Hosted by {listing?.user?.name || "Unknown Host"}</h3>
                      <p className="text-sm text-muted-foreground">{listing?.user?.email || "No email provided"}</p>
                    </div>
                  </div>
                  <Separator className="mb-6" />
                  <div className="space-y-4">
                    <h3 className="font-medium">Contact the host</h3>
                    <Textarea placeholder="Hi, I'm interested in your sublet..." className="min-h-[120px]" value={message} onChange={(e) => setMessage(e.target.value)} />
                    <Button className="w-full" onClick={handleSendMessage} disabled={!message.trim()}> <MessageSquare className="mr-2 h-4 w-4" /> Send Message </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <div className="flex items-center gap-2 text-sm"> <Building className="h-5 w-5 text-primary" /> <p className="font-medium">LeaseLink</p> </div>
          <p className="text-center text-sm text-muted-foreground md:text-left"> © {new Date().getFullYear()} LeaseLink. All rights reserved. </p>
        </div>
      </footer>
    </div>
  );
}