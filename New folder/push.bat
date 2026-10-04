@echo off
set /p commit_msg="Enter commit message: "
if "%commit_msg%"=="" set commit_msg="Update code"

echo Configuring git...
git config user.email "dsavio83@gmail.com"
git config user.name "dsavio83"

echo Staging changes...
git add .

echo Committing...
git commit -m "%commit_msg%"

echo Pushing to GitHub...
git push origin main

echo Done!
pause
