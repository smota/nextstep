# Integrate into the parent and publish

Read for `/git-deliver-merge` once step 4 has proven the feature commit on its remote. A failed standard precondition routes to [exceptions.md](exceptions.md).

Locate the parent's existing worktree. Use it only when clean, idle, and under this operation's ownership. If the parent is not checked out, create a separate integration worktree on that branch; if it exists only remotely, create its local tracking branch there. Keep the source worktree in place, and keep the parent checked out in one worktree.

Fetch the parent destination, inspect local parent-only commits, and fast-forward a behind-only parent with `git merge --ff-only <remote-parent-tip>`. Local-only or divergent parent history requires scope review before publishing it. Record the parent starting ID and the already delivered feature ID.

If the feature is already an ancestor of the parent, no merge is needed. If the parent is an ancestor of the feature, use `git merge --ff-only <delivered-id>`. Otherwise, when repository policy allows merge commits, use `git merge --no-ff --no-commit <delivered-id>`, inspect the combined result, run required checks, then commit. Fast-forwards also require appropriate validation of the resulting tree before parent push. A policy requiring squash, rebase, or a pull request routes to the exceptions reference.

Push the recorded integration commit with `git push <remote> <integration-id>:refs/heads/<parent-destination>`. Verify the remote parent contains both the integration commit and the delivered feature commit. Report any local parent update separately from remote publication. Keep branches and worktrees; cleanup is a separate user request.
