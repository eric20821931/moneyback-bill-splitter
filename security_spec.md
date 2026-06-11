# Security Specification for Bill Splitter

## Data Invariants
1. A user can only see and edit their own profile.
2. A group can only be seen and modified by its members.
3. An expense must belong to a group, and only group members can see or add expenses.
4. An invitation can only be seen by the inviter or the person with the matching email.
5. `createdAt` fields are immutable.
6. Group `ownerId` can only be set upon creation and never changed.

## The Dirty Dozen Payloads
1. Attempt to create a group where `ownerId` is not the current user.
2. Attempt to add a member to a group I don't belong to.
3. Attempt to read an expense from a group I'm not a member of.
4. Attempt to update an expense I didn't create (unless I am direct participant? Actually, standard splitwise allows any member to edit).
5. Attempt to change `createdAt` of a group.
6. Attempt to create an invitation for an email that isn't mine and I didn't invite.
7. Attempt to delete a group if I'm not the owner.
8. Attempt to update `amount` to a negative number.
9. Attempt to inject a 1MB string into the group `name`.
10. Attempt to join a group without an invitation.
11. Attempt to update `payerId` to someone else in an existing expense.
12. Attempt to read PII (email) of a user who isn't my friend (group mate).

## The Test Runner (Snippet)
`firestore.rules.test.ts` will verify these.

## Firestore Rules Draft
(I will generate the actual rules in the next step)
