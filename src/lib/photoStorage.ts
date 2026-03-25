import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { getFirebaseStorage } from './firebase'

/**
 * Firebase Storage layout:
 *   properties/{propertyId}/photos/{timestamp}-{filename}
 *
 * When auth is added, prefix with: users/{uid}/properties/...
 */

function photosRef(propertyId: number) {
  const storage = getFirebaseStorage()
  if (!storage) throw new Error('Firebase Storage not configured')
  return ref(storage, `properties/${propertyId}/photos`)
}

/** Resize an image file to max dimension, return as JPEG Blob. */
function resizeImage(file: File, maxDim = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
          'image/jpeg',
          0.82,
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Upload a photo for a property, returns the download URL. */
export async function uploadPropertyPhoto(propertyId: number, file: File): Promise<string> {
  const blob = await resizeImage(file)
  const name = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const fileRef = ref(photosRef(propertyId).storage, `${photosRef(propertyId).fullPath}/${name}`)
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(fileRef)
}

/** Delete a photo by its download URL. */
export async function deletePropertyPhoto(url: string): Promise<void> {
  const storage = getFirebaseStorage()
  if (!storage) throw new Error('Firebase Storage not configured')
  const fileRef = ref(storage, url)
  await deleteObject(fileRef)
}

/** Delete all photos for a property. */
export async function deleteAllPropertyPhotos(propertyId: number): Promise<void> {
  const folder = photosRef(propertyId)
  const list = await listAll(folder)
  await Promise.all(list.items.map((item) => deleteObject(item)))
}
