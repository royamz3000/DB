import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchLists } from '../api/lists';

const ListsContext = createContext(null);

export function ListsProvider({ children }) {
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');

  const refreshLists = useCallback(async () => {
    const data = await fetchLists();
    setLists(data.lists);
  }, []);

  useEffect(() => {
    refreshLists().catch(() => {});
  }, [refreshLists]);

  const value = useMemo(
    () => ({
      lists,
      selectedListId,
      setSelectedListId,
      selectedList: lists.find((l) => String(l.id) === String(selectedListId)) || null,
      refreshLists,
    }),
    [lists, selectedListId, refreshLists],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists() {
  return useContext(ListsContext);
}
