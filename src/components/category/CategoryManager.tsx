import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCategoryStore } from '../../store';
import type { Category } from '../../db';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Check, GripVertical, MoreHorizontal, UtensilsCrossed, Car, ShoppingBag, Home, Film, HeartPulse, GraduationCap, Smartphone } from 'lucide-react';

// Lucide 图标名称 → 组件的映射
const ICON_MAP: Record<string, React.ElementType> = {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Smartphone,
  MoreHorizontal,
};

function getCategoryIcon(iconName: string | null) {
  const IconComponent = iconName ? ICON_MAP[iconName] : null;
  return IconComponent ? <IconComponent className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />;
}

export default function CategoryManager() {
  const categories = useCategoryStore((s) => s.categories);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const updateCategory = useCategoryStore((s) => s.updateCategory);
  const deleteCategory = useCategoryStore((s) => s.deleteCategory);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const reorderCategories = useCategoryStore((s) => s.reorderCategories);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedLevel1, setExpandedLevel1] = useState<Set<string>>(new Set(['cat-dining', 'cat-transport', 'cat-shopping', 'cat-housing', 'cat-entertainment', 'cat-medical', 'cat-education', 'cat-communication', 'cat-other']));

  // 拖拽状态
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [newColor, setNewColor] = useState('#64748b');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#64748b');
  const [colorPickerEditingId, setColorPickerEditingId] = useState<string | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number } | null>(null);

  const openColorPicker = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setColorPickerPos({ x: rect.left + rect.width + 4, y: rect.top - 4 });
    setColorPickerEditingId(colorPickerEditingId === id ? null : id);
  };

  const level1 = categories.filter((c: Category) => !c.parentId);
  const level2 = categories.filter((c: Category) => c.parentId !== null);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedLevel1);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedLevel1(next);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addCategory({
      name: newName.trim(),
      parentId: newParentId,
      icon: null,
      color: newColor,
      sortOrder: 0,
    });
    setNewName('');
    setNewParentId(null);
    setNewColor('#64748b');
    setShowAddForm(false);
    await fetchCategories();
  };

  const handleSaveEdit = async (id: string, newColor?: string) => {
    if (!editName.trim()) return;
    await updateCategory(id, { name: editName.trim(), color: newColor ?? editColor });
    setEditingId(null);
    setColorPickerEditingId(null);
    await fetchCategories();
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colorPickerEditingId && !(e.target as HTMLElement).closest('[data-color-picker]')) {
        setColorPickerEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPickerEditingId]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个分类吗？')) return;
    await deleteCategory(id);
    await fetchCategories();
  };

  // ─── 拖拽处理 ───────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // 让拖拽幽灵半透明
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingId(null);
    setDragOverId(null);
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== draggingId) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    // 重新排列 level1 分类
    const reordered = level1.map((c) => c.id).filter((id) => id !== draggingId);
    const targetIndex = reordered.indexOf(targetId);
    reordered.splice(targetIndex, 0, draggingId);

    await reorderCategories(reordered);
    setDraggingId(null);
    setDragOverId(null);
  };

  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#ec4899', '#64748b',
  ];

  return (
    <div className="space-y-6">
      {/* 添加分类按钮 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加分类
        </button>
      </div>

      {/* 添加分类表单 */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">添加新分类</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">分类名称</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="请输入分类名称"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">父分类（一级分类留空）</label>
              <select
                value={newParentId || ''}
                onChange={(e) => setNewParentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">一级分类</option>
                {level1.map((c: Category) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">颜色</label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      newColor === color ? 'border-slate-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分类列表 */}
      <div className="space-y-3">
        {level1.map((cat: Category) => {
          const children = level2.filter((c: Category) => c.parentId === cat.id);
          const isExpanded = expandedLevel1.has(cat.id);
          const isDragging = draggingId === cat.id;
          const isDragOver = dragOverId === cat.id;

          return (
            <div
              key={cat.id}
              draggable
              onDragStart={(e) => handleDragStart(e, cat.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, cat.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cat.id)}
              className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all ${
                isDragging ? 'opacity-50 scale-[0.98]' : ''
              } ${isDragOver ? 'border-blue-400 border-2' : ''}`}
            >
              {/* 一级分类 */}
              <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  {/* 拖拽手柄 */}
                  <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#64748b' }}
                  >
                    {getCategoryIcon(cat.icon)}
                  </div>
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(cat.id); }}
                        className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        autoFocus
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); openColorPicker(cat.id, e); }}
                        className="w-5 h-5 rounded border border-slate-300 transition-all hover:scale-110"
                        style={{ backgroundColor: editColor }}
                        title="选择颜色"
                      />
                      <button onClick={() => handleSaveEdit(cat.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="保存">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-slate-800">{cat.name}</span>
                  )}
                  <span className="text-xs text-slate-500">({children.length} 个子分类)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color || '#64748b');
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 二级分类 */}
              {isExpanded && children.length > 0 && (
                <div className="bg-slate-50 border-t border-slate-200">
                  {children.map((child: Category) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs flex-shrink-0"
                          style={{ backgroundColor: child.color || cat.color || '#64748b' }}
                        >
                          {getCategoryIcon(child.icon || cat.icon)}
                        </div>
                        {editingId === child.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(child.id); }}
                              className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                              autoFocus
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); openColorPicker(child.id, e); }}
                              className="w-4 h-4 rounded border border-slate-300 transition-all hover:scale-110"
                              style={{ backgroundColor: editColor }}
                              title="选择颜色"
                            />
                            <button onClick={() => handleSaveEdit(child.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="保存">
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-700">{child.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(child.id);
                            setEditName(child.name);
                            setEditColor(child.color || cat.color || '#64748b');
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(child.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* 添加二级分类 */}
                  <AddSubCategory
                    parentId={cat.id}
                    onAdded={() => fetchCategories()}
                  />
                </div>
              )}
            </div>
          );
        })}

        {level1.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">📂</div>
            <p>暂无分类，点击上方"添加分类"创建</p>
          </div>
        )}
      </div>
      {colorPickerEditingId && colorPickerPos && createPortal(
        <div className="fixed z-[9999] bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex gap-1 flex-wrap"
          style={{ left: colorPickerPos.x, top: colorPickerPos.y }}
          data-color-picker
          onClick={(e) => e.stopPropagation()}
        >
          {colorPresets.map((color) => (
            <button
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                handleSaveEdit(colorPickerEditingId, color);
              }}
              className={`w-5 h-5 rounded border transition-all hover:scale-110 ${
                editColor === color ? 'border-slate-800' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// 子组件：添加二级分类
function AddSubCategory({ parentId, onAdded }: {
  parentId: string;
  onAdded: () => Promise<void>;
}) {
  const addCategory = useCategoryStore((s) => s.addCategory);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addCategory({
      name: name.trim(),
      parentId,
      icon: null,
      color: null,
      sortOrder: 0,
    });
    setName('');
    setShowForm(false);
    await onAdded();
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
      >
        <Plus className="w-3 h-3" />
        添加子分类
      </button>
    );
  }

  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="子分类名称"
        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <button onClick={handleAdd} className="p-1 text-green-600 hover:bg-green-50 rounded">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
