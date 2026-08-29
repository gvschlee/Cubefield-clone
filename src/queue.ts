export class ListNode<T> {
  Next: ListNode<T> | null = null;
  Prev: ListNode<T> | null = null;
  constructor(public Data: T) {}
}

/** Doubly-linked queue matching the AS2 Queue used by CubeField. */
export class Queue<T> {
  First: ListNode<T> | null = null;
  Last: ListNode<T> | null = null;
  Elements = 0;

  Enqueue(data: T): void {
    const node = new ListNode(data);
    if (this.Last === null) {
      this.First = this.Last = node;
    } else {
      node.Prev = this.Last;
      this.Last.Next = node;
      this.Last = node;
    }
    this.Elements++;
  }

  Dequeue(): T | null {
    if (this.First === null) {
      return null;
    }
    const data = this.First.Data;
    this.First = this.First.Next;
    if (this.First !== null) {
      this.First.Prev = null;
    }
    this.Elements--;
    if (this.Elements === 0) {
      this.Last = null;
    }
    return data;
  }

  Clear(): void {
    this.First = this.Last = null;
    this.Elements = 0;
  }
}
