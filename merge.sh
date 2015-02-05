#! /bin/bash
# Merge pushes to dev to master branch
GIT_USER="$2"
GIT_PASS="$3"

CURRENT_BRANCH=$(git status | head -n1 | cut -d" " -f3)
FROM_BRANCH="dev"
TO_BRANCH="master"
echo "current branch is '$CURRENT_BRANCH'"
if [ "$CURRENT_BRANCH" = "$FROM_BRANCH" ] ; then
    echo "Checking out $TO_BRANCH..." && \
    git checkout $TO_BRANCH && \
    echo "Merging changes..." && \
    git merge $FROM_BRANCH && \
    echo "Pushing changes..." && \
    spawn git push && \
    expect ":" && \
    send "$GIT_USER" && \
    expect ":" && \
    send "$GIT_PASS" && \
    echo "Merge complete!" || \
    echo "Error Occurred. Merge failed"
else
    echo "Not on $FROM_BRANCH. Skipping merge"
fi
