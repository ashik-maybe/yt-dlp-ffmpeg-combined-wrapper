Output docs/images/demo.gif

Set FontSize 16
Set Width 1200
Set Height 700
Set Padding 24
Set Framerate 24
Set PlaybackSpeed 1.0
Set Shell "bash"
Set TypingSpeed 30ms

Hide
Type "./dist/combined-wrapper-bun-linux-x64 --plan examples/plans/download-transcode.json"
Enter
Show
Sleep 2s

# Browse the picker.
Down
Sleep 500ms
Up
Sleep 1s

# Search every task.
Type "m"
Sleep 2s
Escape
Sleep 1s

# Show the help overlay.
Type "?"
Sleep 2s
Escape
Sleep 1s

# Open the review screen.
Enter
Sleep 2s

# Move between steps.
Down
Sleep 1s

# Show the dry-run guard.
Type "r"
Sleep 2s

# Quit.
Type "q"
Sleep 1s
