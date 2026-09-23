
# Get HTTP methods and paths from catalogApi.yml
awk '
  /^  \// { path=$1 }
  /^    (get|post|put|patch|delete|options|head|trace):/ {
    method=$1
    sub(/:$/, "", method)
    print toupper(method), path
  }
' catalogApi.yml