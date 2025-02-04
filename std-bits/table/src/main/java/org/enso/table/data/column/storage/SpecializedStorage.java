package org.enso.table.data.column.storage;

import java.util.AbstractList;
import java.util.BitSet;
import java.util.List;
import org.enso.table.data.column.operation.CountNothing;
import org.enso.table.data.column.operation.map.MapOperationProblemAggregator;
import org.enso.table.data.column.operation.map.MapOperationStorage;
import org.enso.table.data.column.storage.type.StorageType;
import org.enso.table.data.mask.OrderMask;
import org.enso.table.data.mask.SliceRange;
import org.graalvm.polyglot.Context;

public abstract class SpecializedStorage<T> extends Storage<T> {

  protected abstract SpecializedStorage<T> newInstance(T[] data, int size);

  protected abstract T[] newUnderlyingArray(int size);

  @Override
  public abstract StorageType getType();

  /**
   * @param data the underlying data
   * @param size the number of items stored
   */
  protected SpecializedStorage(
      T[] data, int size, MapOperationStorage<T, SpecializedStorage<T>> ops) {
    this.data = data;
    this.size = size;
    this.ops = ops;
  }

  protected final T[] data;
  protected final int size;
  private final MapOperationStorage<T, SpecializedStorage<T>> ops;

  /**
   * @inheritDoc
   */
  @Override
  public int size() {
    return size;
  }

  /**
   * @param idx an index
   * @return the data item contained at the given index.
   */
  public T getItem(long idx) {
    return data[(int) idx];
  }

  @Override
  public T getItemBoxed(int idx) {
    return data[idx];
  }

  @Override
  public boolean isNothing(long idx) {
    return data[(int) idx] == null;
  }

  @Override
  public boolean isBinaryOpVectorized(String name) {
    return ops.isSupportedBinary(name);
  }

  @Override
  public boolean isTernaryOpVectorized(String op) {
    return ops.isSupportedTernary(op);
  }

  @Override
  public Storage<?> runVectorizedBinaryMap(
      String name, Object argument, MapOperationProblemAggregator problemAggregator) {
    return ops.runBinaryMap(name, this, argument, problemAggregator);
  }

  @Override
  public Storage<?> runVectorizedTernaryMap(
      String name,
      Object argument0,
      Object argument1,
      MapOperationProblemAggregator problemAggregator) {
    return ops.runTernaryMap(name, this, argument0, argument1, problemAggregator);
  }

  @Override
  public Storage<?> runVectorizedZip(
      String name, Storage<?> argument, MapOperationProblemAggregator problemAggregator) {
    return ops.runZip(name, this, argument, problemAggregator);
  }

  @Override
  public SpecializedStorage<T> applyFilter(BitSet filterMask, int newLength) {
    Context context = Context.getCurrent();
    T[] newData = newUnderlyingArray(newLength);
    int resIx = 0;
    for (int i = 0; i < size; i++) {
      if (filterMask.get(i)) {
        newData[resIx++] = data[i];
      }

      context.safepoint();
    }
    return newInstance(newData, newLength);
  }

  @Override
  public SpecializedStorage<T> applyMask(OrderMask mask) {
    Context context = Context.getCurrent();
    T[] newData = newUnderlyingArray(mask.length());
    for (int i = 0; i < mask.length(); i++) {
      int position = mask.get(i);
      newData[i] = position == Storage.NOT_FOUND_INDEX ? null : data[position];
      context.safepoint();
    }
    return newInstance(newData, newData.length);
  }

  public T[] getData() {
    return data;
  }

  @Override
  public SpecializedStorage<T> slice(int offset, int limit) {
    int newSize = Math.min(size - offset, limit);
    T[] newData = newUnderlyingArray(newSize);
    System.arraycopy(data, offset, newData, 0, newSize);
    return newInstance(newData, newSize);
  }

  @Override
  public SpecializedStorage<T> slice(List<SliceRange> ranges) {
    Context context = Context.getCurrent();
    int newSize = SliceRange.totalLength(ranges);
    T[] newData = newUnderlyingArray(newSize);
    int offset = 0;
    for (SliceRange range : ranges) {
      int length = range.end() - range.start();
      System.arraycopy(data, range.start(), newData, offset, length);
      offset += length;
      context.safepoint();
    }

    return newInstance(newData, newSize);
  }

  @Override
  public Storage<?> appendNulls(int count) {
    T[] newData = newUnderlyingArray(size + count);
    System.arraycopy(data, 0, newData, 0, size);
    return newInstance(newData, size + count);
  }

  @Override
  public Storage<T> fillMissingFromPrevious(BoolStorage missingIndicator) {
    if (missingIndicator != null && CountNothing.anyNothing(missingIndicator)) {
      throw new IllegalArgumentException(
          "Missing indicator must not contain missing values itself.");
    }

    T[] newData = newUnderlyingArray(size);
    T previous = null;
    boolean hasPrevious = false;

    Context context = Context.getCurrent();
    for (int i = 0; i < size; i++) {
      boolean isCurrentValueMissing =
          missingIndicator == null ? isNothing(i) : missingIndicator.getItem(i);
      if (!isCurrentValueMissing) {
        previous = data[i];
        hasPrevious = true;
      }

      newData[i] = hasPrevious ? previous : data[i];
      context.safepoint();
    }

    return newInstance(newData, size);
  }

  @Override
  public List<Object> toList() {
    return new ReadOnlyList<>(this);
  }

  private static class ReadOnlyList<S> extends AbstractList<Object> {
    private final SpecializedStorage<S> storage;

    public ReadOnlyList(SpecializedStorage<S> storage) {
      this.storage = storage;
    }

    @Override
    public Object get(int index) {
      return storage.getItemBoxed(index);
    }

    @Override
    public int size() {
      return storage.size();
    }
  }

  /**
   * Returns the specialized storage casted to my own type, if it is of the same type; or null
   * otherwise.
   */
  @SuppressWarnings("unchecked")
  public SpecializedStorage<T> castIfSameType(SpecializedStorage<?> storage) {
    if (storage.getType().equals(getType())) {
      return (SpecializedStorage<T>) storage;
    } else {
      return null;
    }
  }
}
