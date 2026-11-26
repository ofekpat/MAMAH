#!/bin/bash
# נותן שמות לצילומי המסך שנשמרו ב-solutions/.
#
#   ./tools/rename.sh                 מציג את הצילומים שממתינים, לפי סדר הצילום
#   ./tools/rename.sh 06-2 06-3       מיישם את השמות על הצילומים לפי אותו סדר
#   ./tools/rename.sh 07-1-1 07-1-2   שני עמודים לאותה שאלה
#
# הסדר הוא סדר הצילום, ולכן מספיק לצלם את הפתרונות לפי הסדר ואז להריץ פעם אחת.
set -e
cd "$(dirname "$0")/.."
DIR=solutions

# רק קבצים שעדיין נושאים את שם ברירת המחדל של macOS — קבצים שכבר קיבלו
# מזהה לא ייגעו בהם, כך שאפשר להריץ את הסקריפט שוב בלי לדרוס עבודה קודמת.
pending=()
# stat -f הוא הגרסה של macOS. הפלט הוא "<זמן שינוי> <נתיב>", וסידור מספרי
# עולה נותן את סדר הצילום — הישן ראשון.
while IFS= read -r line; do
  [ -n "$line" ] && pending+=("${line#* }")
done < <(
  find "$DIR" -maxdepth 1 -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \) \
    ! -name '[0-9][0-9]-[0-9]*' -exec stat -f '%m %N' {} + 2>/dev/null | sort -n
)

if [ ${#pending[@]} -eq 0 ]; then
  echo "אין צילומים חדשים ב-$DIR/"
  exit 0
fi

if [ $# -eq 0 ]; then
  echo "ממתינים ${#pending[@]} צילומים, לפי סדר הצילום:"
  i=1; for f in "${pending[@]}"; do printf '  %2d. %s\n' "$i" "$(basename "$f")"; i=$((i+1)); done
  echo
  echo "כדי לתת שמות:  ./tools/rename.sh <מזהה> <מזהה> ..."
  exit 0
fi

if [ $# -gt ${#pending[@]} ]; then
  echo "ניתנו $# מזהים אבל ממתינים רק ${#pending[@]} צילומים." >&2
  exit 1
fi

i=0
for id in "$@"; do
  src="${pending[$i]}"
  ext="${src##*.}"
  dst="$DIR/$id.$ext"
  if [ -e "$dst" ]; then echo "כבר קיים, מדלג: $dst" >&2; i=$((i+1)); continue; fi
  mv "$src" "$dst"
  echo "$(basename "$src")  ->  $id.$ext"
  i=$((i+1))
done

echo
echo "נותרו $(( ${#pending[@]} - $# )) צילומים בלי שם. מריצים עכשיו: node tools/build.js"
