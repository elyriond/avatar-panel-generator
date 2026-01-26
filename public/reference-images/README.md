# Reference Images - Naming Convention

This folder contains reference images for character consistency in AI-generated comic panels.

## 📐 Angle-Aware Reference System

The system automatically detects camera angles from scene descriptions and selects the most appropriate reference images based on **filename conventions**.

## 📝 Naming Convention

**Format:** `{characterName}_{angle}[_{variant}].{ext}`

### Character Name
- Lowercase
- First part of filename before first underscore
- Examples: `theresa`, `ben`

### Camera Angles
The system recognizes these angle keywords in filenames:

| Angle | Filename Keyword | Description |
|-------|-----------------|-------------|
| Frontal | `frontal` | Character faces directly toward camera |
| 3/4 Left | `three_quarter_left` | Character turned ~45° to the left |
| 3/4 Right | `three_quarter_right` | Character turned ~45° to the right |
| Profile Left | `profile_left` | Full side view, left side |
| Profile Right | `profile_right` | Full side view, right side |
| Back | `back` | Character shown from behind |
| Overhead | `overhead` | Camera positioned above, looking down |
| Low Angle | `low_angle` | Camera positioned below, looking up |

### Optional Variant
- Additional descriptor after the angle
- Helps differentiate multiple references of the same angle
- Examples: `smiling`, `neutral`, `thinking`, `speaking`, `1`, `2`, `3`

## ✅ Valid Examples

```
theresa_frontal.jpg                    ✓ Basic frontal view
theresa_frontal_smiling.jpg            ✓ Frontal view, smiling variant
theresa_frontal_1.jpg                  ✓ Frontal view, variant #1
theresa_profile_left.jpg               ✓ Left profile view
theresa_three_quarter_right.jpg        ✓ 3/4 view to the right
theresa_back.jpg                       ✓ Back view
ben_frontal.jpg                        ✓ Ben's frontal view
ben_profile_right_speaking.jpg         ✓ Ben's right profile, speaking
```

## ❌ Invalid Examples

```
Theresa_Frontal.jpg                    ✗ Capital letters (use lowercase)
theresa.jpg                            ✗ Missing angle
theresas_photo.jpg                     ✗ No angle keyword
theresa-frontal.jpg                    ✗ Use underscores, not dashes
```

## 🎯 How It Works

1. **Scene Analysis**: The system analyzes the scene description
   - Example: "Theresa looks over her right shoulder" → Detects `three_quarter_right`

2. **Reference Selection**: Automatically picks matching references
   - First: Exact angle match (`three_quarter_right`)
   - Then: Similar angles (`frontal`, `profile_right`)
   - Finally: Universal fallback (`frontal`)

3. **Image Generation**: Sends 2-3 angle-appropriate references to the AI
   - Result: Better consistency because the AI sees the character from the correct angle

## 📂 Recommended Setup

For each character, provide at minimum:
- ✅ `{name}_frontal.jpg` (required - universal fallback)
- ✅ `{name}_profile_left.jpg`
- ✅ `{name}_profile_right.jpg`
- ⭐ `{name}_three_quarter_left.jpg` (highly recommended)
- ⭐ `{name}_three_quarter_right.jpg` (highly recommended)

Optional but helpful:
- `{name}_back.jpg` (for scenes where character turns away)
- `{name}_frontal_smiling.jpg` (variant with different expression)
- `{name}_frontal_neutral.jpg` (variant with neutral expression)

## 💡 Tips for Best Results

1. **Consistent Lighting**: Use similar lighting across all angles
2. **Same Outfit/Style**: Character should wear the same outfit in all references
3. **Clear, High-Quality**: Use high-resolution, uncompressed images
4. **Minimal Background**: Simple backgrounds help the AI focus on the character
5. **Multiple Variants**: Provide 2-3 images per angle if available (different expressions)

## 🔄 Fallback Behavior

If no angle-specific references are found:
- System falls back to loading ALL references from the character profile
- All references are treated as "frontal" angle
- Works like the old system (no angle selection)

## 📊 Example File Structure

```
/public/reference-images/
├── README.md (this file)
├── theresa_frontal.jpg
├── theresa_frontal_smiling.jpg
├── theresa_profile_left.jpg
├── theresa_profile_right.jpg
├── theresa_three_quarter_left.jpg
├── theresa_three_quarter_right.jpg
├── theresa_back.jpg
├── ben_frontal.jpg
├── ben_profile_left.jpg
└── ben_three_quarter_right.jpg
```

## 🐛 Troubleshooting

**Problem:** References not loading
- ✓ Check filename follows exact pattern: `name_angle[_variant].ext`
- ✓ Use lowercase for character name and angle
- ✓ Use underscores, not spaces or dashes
- ✓ Check browser console for loading errors

**Problem:** Wrong references selected
- ✓ Check scene description contains angle keywords (see table above)
- ✓ Review logs: System logs detected angle in console
- ✓ Add more explicit angle keywords to scene descriptions

**Problem:** Character still inconsistent
- ✓ Ensure reference image quality is high
- ✓ Try providing multiple references per angle
- ✓ Check that all references show the same character appearance
- ✓ Consider using simpler backgrounds in reference images

## 📝 Notes

- System automatically uploads images to imgbb for API compatibility
- References are cached during story generation (no re-uploads per panel)
- Maximum 8 references per panel (KIE.AI API limit)
- System prioritizes exact angle matches, then similar angles

---

**Last Updated:** 2026-01-21
**Version:** 1.0 (Angle-Aware System)
