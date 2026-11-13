# Acting reference images

`cafe-character.png` is a fictional adult character generated with the built-in
image generation tool on October 27, 2026 for this example. Dimensions: 941×1672
(width/height 0.563), suitable for the model’s portrait image input.

Generation prompt:

> Use case: photorealistic-natural. Create a single opening-frame image for a
> character roleplay developer example. Exact portrait 9:16 composition, ideally
> 864x1536. First-person view from across a cozy cafe table at dusk. A fictional
> adult woman in her thirties with short curly dark hair, friendly expressive
> face, olive-green sweater, sitting opposite the viewer; waist-up framing with
> hands resting naturally on the table beside a cream ceramic coffee cup. Warm
> window light, natural skin texture, uncluttered believable cafe background,
> approachable old-friend energy, looking at camera. No other people visible,
> no text, no watermarks, no logos. Keep face and hands fully in frame. Opaque
> photo background.

## Cartoon axolotl

`cartoon-axolotl.png` is an original friendly pink cartoon axolotl generated with the built-in image tool on October 28, 2026 after the user chose an axolotl. It is copied unchanged from the coordinator's supplied asset. Dimensions: 941×1672; size: 2,053,280 bytes; SHA-256: `12018c7baeed2cc5eff1b4d3adb0af4c72ba5c14db179392032ef373b2009836`.

Generation prompt:

> Use case: illustration-story. Create a single opening-frame image for an interactive talking-avatar example. Primary subject: one original friendly cartoon axolotl character, soft pink skin, expressive dark eyes, six fluffy external gill branches, a small clearly visible smiling mouth, short arms and little hands. No resemblance to any existing branded character. Stylized high-quality 3D cartoon illustration with soft tactile shading. The axolotl is upright behind a simple low table in a cozy softly lit aquatic-inspired nook, looking directly at the viewer as if about to tell a short story. Calm welcoming personality suitable for a broad audience. Portrait 9:16 composition, ideally 864x1536; centered head and upper body, full gills and both hands comfortably inside the frame, mouth unobstructed, enough space around arms to support waving and pointing. One character only. Simple softly blurred background and no additional creatures. No text, speech bubbles, logos, watermark or interface elements. Opaque complete illustrated background. This image will be fed unchanged as the first frame for generated video and speech; make it clean, coherent and animation-friendly.

## Shared preset text

The exact café and axolotl character prompts, three follow-up directions each, and 480p/portrait defaults are grouped in `components/happy-oyster/avatar/lib/prompts.ts`. They are editable creative content supplied for this example. Selecting a preset loads its unchanged PNG into the normal upload flow; it does not generate or attach a character automatically.

The café asset remains byte-identical (2,292,009 bytes; SHA-256 `f48037ec020ac5972cfdf0bc558f501d499fb21bf4fc4ffd6d5bad9a185eade1`). Both source PNGs fit Acting's 30 MiB input limit; the older world model's 2 MB limit is separate. No account-specific character IDs ship in the template. Each developer creates characters using their own key and may explicitly save/reuse an ID.
