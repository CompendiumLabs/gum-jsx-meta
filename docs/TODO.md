# Todo

- Explore a `Multipage` element that flows content into fixed-size pages, using
  Stack-style packing and the existing `Document` rendering/export pipeline.
  Start with breaks between blocks; paragraph splitting is feasible with Text's
  line fragments, but needs careful handling of continuations, widows/orphans,
  and headings kept with the following content. Define explicit page breaks and
  behavior for blocks taller than a page.
