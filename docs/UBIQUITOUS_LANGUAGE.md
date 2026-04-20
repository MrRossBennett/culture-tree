# Ubiquitous Language

## Tree structure

| Term                 | Definition                                                                   | Aliases to avoid                 |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| **Culture Tree**     | A curated map of connected cultural references grown from one starting idea. | Graph, map, node tree            |
| **Seed**             | The starting idea at the center of a Culture Tree.                           | Root, root node                  |
| **Branch**           | Any item connected into the Culture Tree beneath the Seed or another Branch. | Node, leaf                       |
| **Top-level Branch** | A Branch connected directly to the Seed.                                     | First-level node                 |
| **Child Branch**     | A Branch connected beneath another Branch.                                   | Child node, subnode              |
| **Leaf Branch**      | A Branch with no child branches.                                             | Node                             |
| **Subtree**          | A Branch together with all of its connected child branches.                  | Branch descendants, node subtree |

## Tree actions

| Term              | Definition                                                                                 | Aliases to avoid                 |
| ----------------- | ------------------------------------------------------------------------------------------ | -------------------------------- |
| **Add Branch**    | The action of attaching a new Branch to a Seed or another Branch.                          | Add node, append node            |
| **Delete Branch** | The action of removing a Branch and its entire Subtree from a Culture Tree.                | Delete node, remove node         |
| **Enrich**        | The action of attaching media, links, and reference metadata to a Culture Tree's branches. | Refresh node data, hydrate nodes |

## Access and ownership

| Term             | Definition                                         | Aliases to avoid         |
| ---------------- | -------------------------------------------------- | ------------------------ |
| **Owner**        | The signed-in person who can edit a Culture Tree.  | User, editor             |
| **Public Tree**  | A Culture Tree that anyone with the link can view. | Shared tree, open tree   |
| **Private Tree** | A Culture Tree that only its Owner can view.       | Hidden tree, locked tree |

## Relationships

- A **Culture Tree** has exactly one **Seed**
- A **Culture Tree** has zero or more **Branches**
- A **Top-level Branch** belongs directly to one **Seed**
- A **Child Branch** belongs directly to one parent **Branch**
- A **Leaf Branch** has zero **Child Branches**
- Deleting a **Branch** removes its entire **Subtree**
- A **Public Tree** can be viewed by non-owners, but only the **Owner** can add or delete **Branches**

## Example dialogue

> **Dev:** "When someone adds a new reference under an existing item, should we call that a **Child Branch**?"
>
> **Domain expert:** "Yes. In the product, every item under the **Seed** or another **Branch** is a **Branch**."
>
> **Dev:** "So we should stop saying 'node' in the UI?"
>
> **Domain expert:** "Exactly. 'Node' is implementation language. The UI should say **Branch**, and the center item should be the **Seed**."
>
> **Dev:** "If someone deletes a **Branch**, do we keep its connected items?"
>
> **Domain expert:** "No. Deleting a **Branch** removes the whole **Subtree** below it."

## Flagged ambiguities

- "node" was being used in the UI for the same concept as **Branch**. Recommendation: keep "node" only in implementation code and use **Branch** in user-facing copy.
- "leaf" was proposed as the general user-facing term, but a **Leaf Branch** is only a branch with no children. Recommendation: use **Branch** as the general term and reserve **Leaf Branch** for the specific no-children case.
- "root" and "seed" refer to the same central concept. Recommendation: use **Seed** in product language and reserve "root" for internal technical discussions if needed.
