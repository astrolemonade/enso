package org.enso.interpreter.runtime.data.hash;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.frame.VirtualFrame;
import java.util.Arrays;
import java.util.Iterator;
import org.enso.interpreter.node.expression.builtin.meta.EqualsNode;
import org.enso.interpreter.node.expression.builtin.meta.HashCodeNode;

/**
 * A storage for a {@link EnsoHashMap}. For one builder, there may be many {@link EnsoHashMap}
 * instances that serve as a snapshot.
 *
 * <p>There should be at most one snapshot for a given generation. All the snapshots should have
 * generation smaller than this builder generation.
 */
final class EnsoHashMapBuilder {
  /**
   * Array of entries. It is only being added into. Both {@code put} and {@code remove} operations
   * just add new entries into it using <em>linear hashing</em>.
   */
  private final StorageEntry[] byHash;

  /**
   * number of entries in the {@code byHash} array. With every change to the builder, the generation
   * increases by one. Once the generation reaches 75% of {@code byHash.length} it is time to
   * <em>rehash</em> into new builder.
   */
  private int generation;

  /**
   * the actual number of entries in the builder at the latest {@code generation}.
   *
   * <ul>
   *   <li>{@code put} of new key increases it
   *   <li>{@code put} over existing key doesn't change it
   *   <li>{@code remove} of a key decreases it
   * </ul>
   */
  private int actualSize;

  /**
   * Creates an empty builder with given capacity. The capacity specifies the size of array of
   * {@link StorageEntry} instances. The {@code put} and {@code remove} operations add entries into
   * the array until it is 75% full.
   */
  private EnsoHashMapBuilder(int initialCapacity) {
    this.byHash = new StorageEntry[initialCapacity];
  }

  /** Create a new builder with default size being {@code 11}. */
  static EnsoHashMapBuilder create() {
    return new EnsoHashMapBuilder(11);
  }

  static EnsoHashMapBuilder createWithCapacity(int capacity) {
    assert capacity > 0;
    return new EnsoHashMapBuilder(capacity);
  }

  /** Returns count of elements in the storage. */
  int generation() {
    return generation;
  }

  /** Returns the actual number of visible elements in current generation. */
  int size() {
    return actualSize;
  }

  /**
   * Provides access to all {@code StorageEntry} in this builder at given {@code atGeneration}.
   * Classical usage is to {@code for (var e : this) if (e.isVisible(atGeneration) operation(e))}.
   */
  StorageEntry[] getEntries(int atGeneration, int size) {
    var arr = new StorageEntry[size];
    var at = 0;
    for (var i = 0; i < byHash.length; i++) {
      var e = byHash[i];
      if (e != null && e.isVisible(atGeneration)) {
        arr[at++] = e;
      }
    }
    if (at != arr.length) {
      return Arrays.copyOf(arr, at);
    } else {
      return arr;
    }
  }

  record Entry(Object key, Object value) {}

  Iterator<Entry> getEntriesIterator(int atGeneration) {
    return new EntriesIterator(atGeneration);
  }

  final class EntriesIterator implements Iterator<Entry> {
    private final int atGeneration;
    private int nextVisibleEntryIdx = -1;

    EntriesIterator(int atGeneration) {
      this.atGeneration = atGeneration;
      skipToNextVisibleEntry();
    }

    @Override
    public boolean hasNext() {
      if (nextVisibleEntryIdx >= byHash.length) {
        return false;
      }
      var entry = byHash[nextVisibleEntryIdx];
      return entry != null && entry.isVisible(atGeneration);
    }

    @Override
    public Entry next() {
      var entry = byHash[nextVisibleEntryIdx];
      skipToNextVisibleEntry();
      return new Entry(entry.key(), entry.value());
    }

    private void skipToNextVisibleEntry() {
      while (true) {
        nextVisibleEntryIdx++;
        if (nextVisibleEntryIdx == byHash.length) {
          break;
        }
        var entry = byHash[nextVisibleEntryIdx];
        if (entry != null && entry.isVisible(atGeneration)) {
          break;
        }
      }
    }
  }

  /**
   * Prepares a builder ready for modification at given generation. It may return {@code this} if
   * the {@code atGeneration == this.generation} and the {@code byHash} array is less than 75% full.
   * Otherwise it may return new builder suitable for additions.
   */
  EnsoHashMapBuilder asModifiable(
      VirtualFrame frame, int atGeneration, HashCodeNode hashCodeNode, EqualsNode equalsNode) {
    if (atGeneration != generation || generation * 4 > byHash.length * 3) {
      var newSize = Math.max(actualSize * 2, byHash.length);
      return rehash(frame, newSize, atGeneration, hashCodeNode, equalsNode);
    } else {
      return this;
    }
  }

  /**
   * Adds a key-value mapping. Uses {@code hashCodeNode} to compute hash and based on it location in
   * the array. Then it searches for first empty slot after the identified location. If it finds an
   * equal key, it marks it as removed, if it hasn't been removed yet. Once it finds an empty slot,
   * it puts there a new entry with the next generation.
   */
  void put(
      VirtualFrame frame,
      Object key,
      Object value,
      HashCodeNode hashCodeNode,
      EqualsNode equalsNode) {
    assert actualSize <= generation;
    var at = findWhereToStart(key, hashCodeNode);
    var nextGeneration = ++generation;
    var replacingExistingKey = false;
    for (var i = 0; i < byHash.length; i++) {
      if (byHash[at] == null) {
        if (!replacingExistingKey) {
          actualSize++;
        }
        byHash[at] = new StorageEntry(key, value, nextGeneration);
        return;
      }
      if (compare(frame, equalsNode, byHash[at].key(), key)) {
        var invalidatedEntry = byHash[at].markRemoved(nextGeneration);
        if (invalidatedEntry != byHash[at]) {
          byHash[at] = invalidatedEntry;
          replacingExistingKey = true;
        }
      }
      if (++at == byHash.length) {
        at = 0;
      }
    }
    throw CompilerDirectives.shouldNotReachHere("byHash array is full!");
  }

  /**
   * Finds storage entry for given key or {@code null}. Searches only entries that are visible for
   * given {@code generation}.
   */
  StorageEntry get(
      VirtualFrame frame,
      Object key,
      int generation,
      HashCodeNode hashCodeNode,
      EqualsNode equalsNode) {
    var at = findWhereToStart(key, hashCodeNode);
    for (var i = 0; i < byHash.length; i++) {
      if (byHash[at] == null) {
        return null;
      }
      if (byHash[at].isVisible(generation)) {
        if (compare(frame, equalsNode, key, byHash[at].key())) {
          return byHash[at];
        }
      }
      if (++at == byHash.length) {
        at = 0;
      }
    }
    throw CompilerDirectives.shouldNotReachHere("byHash array is full!");
  }

  private int findWhereToStart(Object key, HashCodeNode hashCodeNode) {
    var hash = Math.abs(hashCodeNode.execute(key));
    var at = (int) (hash % byHash.length);
    return at;
  }

  /**
   * Removes an entry denoted by the given key. Removal is "non-destructive" - the "removed" entry
   * stays in the array - only its {@link StorageEntry#removed()} value is set to the next
   * generation.
   *
   * @return true if the removal was successful false otherwise.
   */
  boolean remove(VirtualFrame frame, Object key, HashCodeNode hashCodeNode, EqualsNode equalsNode) {
    assert actualSize <= generation;
    var at = findWhereToStart(key, hashCodeNode);
    var nextGeneration = ++generation;
    for (var i = 0; i < byHash.length; i++) {
      if (byHash[at] == null) {
        return false;
      }
      if (compare(frame, equalsNode, key, byHash[at].key())) {
        var invalidatedEntry = byHash[at].markRemoved(nextGeneration);
        if (invalidatedEntry != byHash[at]) {
          byHash[at] = invalidatedEntry;
          actualSize--;
          return true;
        }
      }
      if (++at == byHash.length) {
        at = 0;
      }
    }
    throw CompilerDirectives.shouldNotReachHere("byHash array is full!");
  }

  /**
   * Builds a new builder with given array size and puts into it all entries that are valid {@code
   * atGeneration}.
   */
  private EnsoHashMapBuilder rehash(
      VirtualFrame frame,
      int size,
      int atGeneration,
      HashCodeNode hashCodeNode,
      EqualsNode equalsNode) {
    var newBuilder = new EnsoHashMapBuilder(size);
    for (var i = 0; i < byHash.length; i++) {
      var entry = byHash[i];
      if (entry != null && entry.isVisible(atGeneration)) {
        newBuilder.put(frame, entry.key(), entry.value(), hashCodeNode, equalsNode);
      }
    }
    assert newBuilder.actualSize <= size;
    return newBuilder;
  }

  /**
   * Creates a snapshot with the current size. The created snapshot contains all the entries that
   * are in the storage as of this moment, i.e., all the entries with their indexes lesser than
   * {@code generation}.
   *
   * <p>Should be called at most once for a particular {@code generation}.
   *
   * @return A new hash map snapshot.
   */
  EnsoHashMap build() {
    return EnsoHashMap.createWithBuilder(this);
  }

  @Override
  public String toString() {
    return "EnsoHashMapBuilder{generation = "
        + generation
        + ", actualSize = "
        + actualSize
        + ", storage = "
        + Arrays.toString(byHash)
        + "}";
  }

  private static boolean compare(VirtualFrame frame, EqualsNode equalsNode, Object a, Object b) {
    if (a instanceof Double aDbl && b instanceof Double bDbl && aDbl.isNaN() && bDbl.isNaN()) {
      return true;
    } else {
      return equalsNode.execute(frame, a, b);
    }
  }

  record StorageEntry(
      Object key,
      Object value,
      /**
       * A generation the entry got into this map. {@link EnsoHashMap} uses it for checking whether
       * a certain key belongs in that map.
       */
      int added,
      /** Remove at a generation. */
      int removed) {
    StorageEntry(Object key, Object value, int added) {
      this(key, value, added, Integer.MAX_VALUE);
    }

    boolean isVisible(int generation) {
      assert added() < removed();
      return added() <= generation && generation < removed();
    }

    StorageEntry markRemoved(int when) {
      assert added() < removed();
      if (removed() <= when) {
        return this;
      } else {
        return new StorageEntry(key(), value(), added(), when);
      }
    }
  }
}
